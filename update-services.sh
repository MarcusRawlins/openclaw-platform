#!/bin/bash

API_KEY="rnd_4AhDOc2OWXPhzpsbKRFjTAFOuSpa"

declare -a SERVICES=(
  "srv-d6dtdtfgi27c738mm5vg:r3-auto-repair-demo"
  "srv-d6dte195pdvs73fm0mmg:r3-restaurant-demo"
  "srv-d6dte0vgi27c738mm7fg:r3-realtor-demo"
  "srv-d6dte1vgi27c738mm8k0:r3-summit-hvac-demo"
)

for service_data in "${SERVICES[@]}"; do
  IFS=':' read -r service_id service_name <<< "$service_data"
  
  echo "🔧 Updating ${service_name}..."
  
  # Update service configuration
  response=$(curl -s -X PATCH "https://api.render.com/v1/services/${service_id}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "serviceDetails": {
        "buildCommand": "npm install && npm run build",
        "publishPath": "./out"
      }
    }')
  
  echo "Update response: $response" | head -c 200
  echo ""
  
  # Trigger deploy
  echo "🚀 Triggering deploy for ${service_name}..."
  deploy_response=$(curl -s -X POST "https://api.render.com/v1/services/${service_id}/deploys" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"clearCache": "clear"}')
  
  echo "Deploy response: $deploy_response" | head -c 200
  echo ""
  echo "---"
  sleep 2
done

echo "✅ All services updated and deploy triggered!"
