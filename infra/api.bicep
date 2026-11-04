param appName string = 'viaalerta-api'
param environmentName string = 'viaalerta-env'
param pullIdentityName string = 'viaalerta-pull'
param registryServer string
param image string
param supabaseUrl string
@secure()
param supabasePublicKey string
param corsOrigins string
param modelSha256 string

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: pullIdentityName
}
resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: environment.location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: registryServer
          identity: pullIdentity.id
        }
      ]
      secrets: [
        {
          name: 'supabase-public-key'
          value: supabasePublicKey
        }
      ]
    }
    template: {
      containers: [{
        name: 'api'
        image: image
        resources: {
          cpu: 1
          memory: '2Gi'
        }
        env: [
          {
            name: 'MODEL_PATH'
            value: '/app/models/best.pt'
          }
          {
            name: 'EXPECTED_MODEL_SHA256'
            value: modelSha256
          }
          {
            name: 'SUPABASE_URL'
            value: supabaseUrl
          }
          {
            name: 'SUPABASE_PUBLISHABLE_KEY'
            secretRef: 'supabase-public-key'
          }
          {
            name: 'CORS_ORIGINS'
            value: corsOrigins
          }
          {
            name: 'DEVICE'
            value: 'cpu'
          }
          {
            name: 'CPU_THREADS'
            value: '1'
          }
          {
            name: 'CONFIANCA'
            value: '0.25'
          }
        ]
        probes: [
          {
            type: 'Startup'
            httpGet: {
              path: '/health'
              port: 8000
            }
            initialDelaySeconds: 1
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 60
          }
          {
            type: 'Readiness'
            httpGet: {
              path: '/health'
              port: 8000
            }
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          }
          {
            type: 'Liveness'
            httpGet: {
              path: '/health'
              port: 8000
            }
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          }
        ]
      }]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}
output host string = api.properties.configuration.ingress!.fqdn!
output detectionUrl string = 'https://${api.properties.configuration.ingress!.fqdn!}/detect'
