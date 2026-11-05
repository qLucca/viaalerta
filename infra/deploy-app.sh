#!/usr/bin/env bash
set -euo pipefail
component="${1:?Informe web ou api}"
image="${2:?Informe a imagem com tag}"
: "${AZURE_RESOURCE_GROUP:?}" "${AZURE_CONTAINER_ENV:?}" "${AZURE_REGISTRY_SERVER:?}" "${AZURE_PULL_IDENTITY:?}"
case "$component" in
  web)
    port=3000; cpu=0.5; memory=1Gi
    env_args=("NODE_ENV=production")
    ;;
  api)
    port=8000; cpu=1.0; memory=2Gi
    : "${SUPABASE_URL:?}" "${SUPABASE_PUBLISHABLE_KEY:?}" "${CORS_ORIGINS:?}"
    env_args=("MODEL_PATH=/app/models/best.pt" "SUPABASE_URL=$SUPABASE_URL" "SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY" "CORS_ORIGINS=$CORS_ORIGINS")
    ;;
  *) echo 'Componente inválido.' >&2; exit 1 ;;
esac
name="viaalerta-$component"
if [[ "$component" == api ]]; then
  : "${MODEL_SHA256:?Informe o hash do checkpoint publicado}"
  template="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/api.bicep"
  environment_location=$(az containerapp env show -n "$AZURE_CONTAINER_ENV" -g "$AZURE_RESOURCE_GROUP" --query location -o tsv)
  az deployment group create --name "viaalerta-api-${GITHUB_RUN_ID:-$(date +%s)}" \
    --resource-group "$AZURE_RESOURCE_GROUP" --template-file "$template" \
    --parameters appName="$name" location="$environment_location" environmentName="$AZURE_CONTAINER_ENV" \
      pullIdentityName="${AZURE_PULL_IDENTITY##*/}" registryServer="$AZURE_REGISTRY_SERVER" \
      image="$image" supabaseUrl="$SUPABASE_URL" supabasePublicKey="$SUPABASE_PUBLISHABLE_KEY" \
      corsOrigins="$CORS_ORIGINS" modelSha256="$MODEL_SHA256" --only-show-errors --output none
else
  existing=$(az containerapp list -g "$AZURE_RESOURCE_GROUP" --query "[?name=='$name'].name | [0]" -o tsv)
  if [[ -n "$existing" ]]; then
  az containerapp update -n "$name" -g "$AZURE_RESOURCE_GROUP" --image "$image" \
    --set-env-vars "${env_args[@]}" --cpu "$cpu" --memory "$memory" \
    --min-replicas 1 --max-replicas 1 --output none
  else
  az containerapp create -n "$name" -g "$AZURE_RESOURCE_GROUP" \
    --environment "$AZURE_CONTAINER_ENV" --image "$image" \
    --user-assigned "$AZURE_PULL_IDENTITY" --registry-identity "$AZURE_PULL_IDENTITY" \
    --registry-server "$AZURE_REGISTRY_SERVER" --ingress external --target-port "$port" \
    --cpu "$cpu" --memory "$memory" --min-replicas 1 --max-replicas 1 \
    --env-vars "${env_args[@]}" --output none
  fi
fi
host=$(az containerapp show -n "$name" -g "$AZURE_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
if [[ "$component" == api ]]; then
  ready=false
  for attempt in {1..60}; do
    # Consulta a saude da revisao; latestReadyRevisionName pode vir ausente na CLI.
    revision=$(az containerapp revision list -n "$name" -g "$AZURE_RESOURCE_GROUP" \
      --query "[?properties.active && properties.healthState=='Healthy' && properties.runningState=='Running' && properties.template.containers[0].image=='$image'].name | [0]" -o tsv --only-show-errors)
    if [[ -n "$revision" ]]; then ready=true; break; fi
    sleep 5
  done
  [[ "$ready" == true ]] || { echo 'A nova revisão não ficou pronta. Confira os logs na Azure.' >&2; exit 1; }
  health=$(curl --fail --retry 12 --retry-delay 10 --retry-all-errors --max-time 15 "https://$host/health")
  : "${MODEL_SHA256:?Informe o hash do checkpoint publicado}"
  HEALTH_JSON="$health" python - <<'PY'
import json
import os
health = json.loads(os.environ['HEALTH_JSON'])
assert health.get('status') == 'ok', 'API indisponível'
assert health.get('model_sha256') == os.environ['MODEL_SHA256'], 'Checkpoint publicado não corresponde à Release'
PY
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 \
    --form 'file=@api/requirements.txt;type=text/plain' "https://$host/detect")
  [[ "$code" == 401 ]] || { echo 'A API não recusou a requisição sem autenticação.' >&2; exit 1; }
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 \
    --header 'Authorization: Bearer invalid-deployment-test-token' \
    --form 'file=@api/requirements.txt;type=text/plain' "https://$host/detect")
  [[ "$code" == 401 ]] || { echo 'A API não recusou o token inválido.' >&2; exit 1; }
else
  curl --fail --retry 6 --retry-delay 10 --retry-all-errors --max-time 15 --output /dev/null "https://$host/"
fi
echo "URL: https://$host"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "URL publicada: https://$host" >> "$GITHUB_STEP_SUMMARY"
  [[ "$component" != api ]] || echo "Endpoint de detecção: https://$host/detect" >> "$GITHUB_STEP_SUMMARY"
fi
