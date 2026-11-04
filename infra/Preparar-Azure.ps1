#requires -Version 7.3
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$RegistryName,
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
if ($RegistryName -notmatch '^[a-z0-9]{5,50}$') { throw 'RegistryName deve ter de 5 a 50 letras minúsculas/números e ser globalmente único.' }
Invoke-Azure -Arguments @('account','set','--subscription',$SubscriptionId)
Invoke-Azure -Arguments @('extension','add','--name','containerapp','--upgrade','--only-show-errors')
foreach ($provider in @('Microsoft.App','Microsoft.OperationalInsights','Microsoft.ContainerRegistry','Microsoft.ManagedIdentity')) {
    Invoke-Azure -Arguments @('provider','register','--namespace',$provider,'--wait','--only-show-errors')
}
Invoke-Azure -Arguments @('group','create','--name',$ResourceGroup,'--location',$Location,'--output','none')
Invoke-Azure -Arguments @('acr','create','--name',$RegistryName,'--resource-group',$ResourceGroup,'--sku','Basic','--admin-enabled','false','--output','none')
$registry = Invoke-Azure -Arguments @('acr','show','--name',$RegistryName,'--resource-group',$ResourceGroup,'--output','json') | ConvertFrom-Json
$identity = Invoke-Azure -Arguments @('identity','create','--name','viaalerta-pull','--resource-group',$ResourceGroup,'--output','json') | ConvertFrom-Json
$roles = Invoke-Azure -Arguments @('role','assignment','list','--assignee',$identity.principalId,'--scope',$registry.id,'--role','AcrPull','--output','json') | ConvertFrom-Json
if (-not $roles) {
    Invoke-Azure -Arguments @('role','assignment','create','--assignee-object-id',$identity.principalId,'--assignee-principal-type','ServicePrincipal','--scope',$registry.id,'--role','AcrPull','--output','none')
}
Invoke-Azure -Arguments @('containerapp','env','create','--name','viaalerta-env','--resource-group',$ResourceGroup,'--location',$Location,'--logs-destination','none','--output','none')
$config = [ordered]@{
    AZURE_SUBSCRIPTION_ID = $SubscriptionId
    AZURE_RESOURCE_GROUP = $ResourceGroup
    AZURE_CONTAINER_ENV = 'viaalerta-env'
    AZURE_REGISTRY = $RegistryName
    AZURE_REGISTRY_SERVER = $registry.loginServer
    AZURE_PULL_IDENTITY = $identity.id
}
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'azure.local.json') -Encoding utf8
Write-Host 'Infraestrutura preparada. Configure OIDC e as variáveis dos workflows antes de publicar.'
Write-Host 'Este script cria recursos cobrados. Configure um alerta de orçamento na assinatura.'
