#!/bin/bash

RENDER_API_KEY="Q7B3-BF63-UA0R-P5I7"

declare -A REPOS
REPOS["auto-repair-demo"]="MarcusRawlins/auto-repair-demo"
REPOS["restaurant-demo"]="MarcusRawlins/restaurant-demo"
REPOS["realtor-demo"]="MarcusRawlins/realtor-demo"
REPOS["summit-hvac-demo"]="MarcusRawlins/summit-hvac-demo"

echo "# R3 Studios Demo Sites - Render Deployment" > demos/RENDER-DEPLOYED.md
echo "" >> demos/RENDER-DEPLOYED.md
echo "**Deployed on:** $(date)" >> demos/RENDER-DEPLOYED.md
echo "" >> demos/RENDER-DEPLOYED.md

for demo in "${!REPOS[@]}"; do
  repo="${REPOS[$demo]}"
  service_name="r3-${demo}"
  
  echo "📦 Deploying ${service_name}..."
  
  response=$(curl -s -X POST "https://api.render.com/v1/services" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"web_service\",
      \"name\": \"${service_name}\",
      \"repo\": \"https://github.com/${repo}\",
      \"autoDeploy\": \"yes\",
      \"branch\": \"main\",
      \"buildCommand\": \"npm install && npm run build\",
      \"startCommand\": \"npm start\",
      \"serviceDetails\": {
        \"env\": \"node\",
        \"plan\": \"free\"
      }
    }")
  
  echo "Response: $response"
  echo ""
  
  service_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$service_id" ]; then
    service_url="https://${service_name}.onrender.com"
    echo "## ${demo}" >> demos/RENDER-DEPLOYED.md
    echo "- **Service Name:** ${service_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **Service ID:** ${service_id}" >> demos/RENDER-DEPLOYED.md
    echo "- **GitHub Repo:** https://github.com/${repo}" >> demos/RENDER-DEPLOYED.md
    echo "- **Live URL:** ${service_url}" >> demos/RENDER-DEPLOYED.md
    echo "" >> demos/RENDER-DEPLOYED.md
    echo "✅ ${service_name} deployed"
  else
    echo "## ${demo}" >> demos/RENDER-DEPLOYED.md
    echo "- **Service Name:** ${service_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **Status:** ⚠️ Deployment failed" >> demos/RENDER-DEPLOYED.md
    echo "- **Response:** \`${response}\`" >> demos/RENDER-DEPLOYED.md
    echo "" >> demos/RENDER-DEPLOYED.md
    echo "❌ ${service_name} failed"
  fi
  
  sleep 2
done

echo ""
echo "✨ Deployment process complete!"
