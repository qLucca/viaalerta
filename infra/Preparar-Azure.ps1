#requires -Version 7.3
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$RegistryName,
    [Parameter(Mandatory)][string]$GitHubRepository,
    [Parameter(Mandatory)][string]$GitHubOidcSubject,
    [string]$ResourceGroup = 'rg-viaalerta',
    [string]$Location = 'centralus'
)
$ErrorActionPreference = 'Stop'

function Invoke-Azure {
    param([string[]]$Arguments)
    & az @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falha na Azure CLI: $($Arguments[0..1] -join ' ')" }
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Instale a Azure CLI e execute az login primeiro.' }
if ($RegistryName -notmatch '^[a-z0-9]{5,50}$') { throw 'RegistryName deve ter de 5 a 50 letras minúsculas/números.' }
if ($GitHubRepository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Use GitHubRepository no formato usuario/repositorio.' }
$repositoryParts = $GitHubRepository.Split('/')
$subjectPattern = '^repo:' + [regex]::Escape($repositoryParts[0]) + '(?:@\d+)?/' + [regex]::Escape($repositoryParts[1]) + '(?:@\d+)?:environment:production$'
if ($GitHubOidcSubject -notmatch $subjectPattern) { throw 'Copie o subject claim do log azure/login deste repositório e ambiente production.' }
Invoke-Azure -Arguments @('account','set','--subscription',$SubscriptionId)
$account = Invoke-Azure -Arguments @('account','show','--output','json') | ConvertFrom-Json
$group = Invoke-Azure -Arguments @('group','show','--name',$ResourceGroup,'--output','json') | ConvertFrom-Json
$registry = Invoke-Azure -Arguments @('acr','show','--name',$RegistryName,'--resource-group',$ResourceGroup,'--output','json') | ConvertFrom-Json
Invoke-Azure -Arguments @('extension','add','--name','containerapp','--upgrade','--only-show-errors')
foreach ($provider in @('Microsoft.App','Microsoft.OperationalInsights','Microsoft.ContainerRegistry','Microsoft.ManagedIdentity')) {
    Invoke-Azure -Arguments @('provider','register','--namespace',$provider,'--wait','--only-show-errors')
}
function Ensure-Role {
    param([string]$PrincipalId, [string]$Scope, [string]$Role)
    $query = "[?principalId=='$PrincipalId' && roleDefinitionName=='$Role']"
    $assignments = Invoke-Azure -Arguments @('role','assignment','list','--scope',$Scope,'--query',$query,'--output','json') | ConvertFrom-Json
    if (-not $assignments) {
        Invoke-Azure -Arguments @('role','assignment','create','--assignee-object-id',$PrincipalId,'--assignee-principal-type','ServicePrincipal','--scope',$Scope,'--role',$Role,'--output','none')
    }
}
function Ensure-Identity {
    param([string]$Name)
    $found = Invoke-Azure -Arguments @('identity','list','--resource-group',$ResourceGroup,'--query',"[?name=='$Name'] | [0]",'--output','json') | ConvertFrom-Json
    if ($found) { return $found }
    Invoke-Azure -Arguments @('identity','create','--name',$Name,'--resource-group',$ResourceGroup,'--location',$Location,'--output','json') | ConvertFrom-Json
}
$identity = Ensure-Identity -Name 'viaalerta-pull'
$deploymentIdentity = Ensure-Identity -Name 'viaalerta-deploy'
$pullRole = 'AcrPull'
$pushRole = 'AcrPush'
if ($registry.roleAssignmentMode -eq 'AbacRepositoryPermissions') {
    $pullRole = 'Container Registry Repository Reader'
    $pushRole = 'Container Registry Repository Writer'
}
Ensure-Role -PrincipalId $identity.principalId -Scope $registry.id -Role $pullRole
Ensure-Role -PrincipalId $deploymentIdentity.principalId -Scope $group.id -Role 'Contributor'
Ensure-Role -PrincipalId $deploymentIdentity.principalId -Scope $registry.id -Role $pushRole
$federation = Invoke-Azure -Arguments @('identity','federated-credential','list','--identity-name','viaalerta-deploy','--resource-group',$ResourceGroup,'--query',"[?name=='github-production'] | [0]",'--output','json') | ConvertFrom-Json
$federationOperation = if ($federation) { 'update' } else { 'create' }
Invoke-Azure -Arguments @('identity','federated-credential',$federationOperation,'--name','github-production','--identity-name','viaalerta-deploy','--resource-group',$ResourceGroup,'--issuer','https://token.actions.githubusercontent.com','--subject',$GitHubOidcSubject,'--audiences','api://AzureADTokenExchange','--output','none')
$containerEnvironment = Invoke-Azure -Arguments @('containerapp','env','list','--resource-group',$ResourceGroup,'--query',"[?name=='viaalerta-env'] | [0]",'--output','json') | ConvertFrom-Json
if (-not $containerEnvironment) {
    Invoke-Azure -Arguments @('containerapp','env','create','--name','viaalerta-env','--resource-group',$ResourceGroup,'--location',$Location,'--logs-destination','none','--output','none')
}
$config = [ordered]@{
    AZURE_CLIENT_ID = $deploymentIdentity.clientId
    AZURE_TENANT_ID = $account.tenantId
    AZURE_SUBSCRIPTION_ID = $SubscriptionId
    AZURE_RESOURCE_GROUP = $ResourceGroup
    AZURE_CONTAINER_ENV = 'viaalerta-env'
    AZURE_REGISTRY = $RegistryName
    AZURE_REGISTRY_SERVER = $registry.loginServer
    AZURE_PULL_IDENTITY = $identity.id
}
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'azure.local.json') -Encoding utf8
$configuredGitHub = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    & gh auth status --hostname github.com *> $null
    if ($LASTEXITCODE -eq 0) {
        foreach ($item in $config.GetEnumerator()) {
            if ($item.Key -in @('AZURE_CLIENT_ID','AZURE_TENANT_ID')) {
                & gh secret set $item.Key --body $item.Value --repo $GitHubRepository
                if ($LASTEXITCODE -ne 0) { throw "Não foi possível configurar o secret $($item.Key) no GitHub." }
            }
            & gh variable set $item.Key --body $item.Value --repo $GitHubRepository
            if ($LASTEXITCODE -ne 0) { throw "Não foi possível configurar $($item.Key) no GitHub." }
        }
        $configuredGitHub = $true
    }
}
Write-Host 'Ambiente e OIDC preparados. O grupo e o Registry existentes foram reutilizados.'
if ($configuredGitHub) {
    Write-Host 'Variáveis Azure configuradas no GitHub. Aguarde a propagação das permissões e execute Publicar API com modelo treinado.'
} else {
    Write-Host 'No GitHub > Settings > Secrets and variables > Actions > Secrets, atualize estes dois valores:'
    Write-Host "AZURE_CLIENT_ID=$($config.AZURE_CLIENT_ID)"
    Write-Host "AZURE_TENANT_ID=$($config.AZURE_TENANT_ID)"
    Write-Host 'Os demais valores foram salvos em azure.local.json. Não envie esse arquivo ao Git.'
}
Write-Host 'Este script não publica a API. O deploy posterior mantém uma réplica ativa e pode consumir créditos Azure.'
