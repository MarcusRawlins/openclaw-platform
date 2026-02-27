#!/bin/bash

API_KEY="rnd_4AhDOc2OWXPhzpsbKRFjTAFOuSpa"
OWNER_ID="tea-d668l4fgi27c73a8jeb0"

REPOS=(
  "MarcusRawlins/auto-repair-demo"
  "MarcusRawlins/restaurant-demo"
  "MarcusRawlins/realtor-demo"
  "MarcusRawlins/summit-hvac-demo"
)

echo "# R3 Studios Demo Sites - Render Deployment" > demos/RENDER-DEPLOYED.md
echo "" >> demos/RENDER-DEPLOYED.md
echo "**Deployed on:** $(date)" >> demos/RENDER-DEPLOYED.md
echo "**Owner:** marcus@marcusrawlins.com" >> demos/RENDER-DEPLOYED.md
echo "" >> demos/RENDER-DEPLOYED.md

for repo in "${REPOS[@]}"; do
  demo_name=$(basename $repo)
  service_name="r3-${demo_name}"
  
  echo ""
  echo "🚀 Deploying ${service_name}..."
  
  # Deploy via Blueprints API (blueprint auto-sync)
  response=$(curl -s -X POST "https://api.render.com/v1/blueprints/repo" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"ownerId\": \"${OWNER_ID}\",
      \"repo\": \"https://github.com/${repo}\",
      \"branch\": \"main\",
      \"autoDeploy\": true
    }")
  
  echo "Response: $response"
  
  # Check if successful
  if echo "$response" | grep -q '"id"'; then
    service_url="https://${service_name}.onrender.com"
    
    echo "## ${demo_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **Service Name:** ${service_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **GitHub Repo:** https://github.com/${repo}" >> demos/RENDER-DEPLOYED.md
    echo "- **Live URL:** ${service_url}" >> demos/RENDER-DEPLOYED.md
    echo "- **Status:** ✅ Deployed" >> demos/RENDER-DEPLOYED.md
    echo "" >> demos/RENDER-DEPLOYED.md
    
    echo "✅ ${service_name} deployed successfully"
  else
    echo "## ${demo_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **Service Name:** ${service_name}" >> demos/RENDER-DEPLOYED.md
    echo "- **GitHub Repo:** https://github.com/${repo}" >> demos/RENDER-DEPLOYED.md
    echo "- **Status:** ⚠️ Deployment failed" >> demos/RENDER-DEPLOYED.md
    echo "- **Error:** See deployment logs" >> demos/RENDER-DEPLOYED.md
    echo "" >> demos/RENDER-DEPLOYED.md
    
    echo "❌ ${service_name} failed"
  fi
  
  sleep 2
done

echo ""
echo "✨ Deployment process complete!"
echo "📄 Results: demos/RENDER-DEPLOYED.md"
