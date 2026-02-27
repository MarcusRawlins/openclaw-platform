#!/bin/bash

RENDER_API_KEY="Q7B3-BF63-UA0R-P5I7"

echo "🦫 Brunel: Deploying 4 new demo sites to Render..."
echo ""

# Deploy apex-plumbing-demo
echo "📦 Deploying r3-apex-plumbing-demo..."
response=$(curl -s -X POST "https://api.render.com/v1/static-sites" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r3-apex-plumbing-demo",
    "repo": "https://github.com/MarcusRawlins/apex-plumbing-demo",
    "autoDeploy": true,
    "branch": "main",
    "buildCommand": "npm install && npm run build",
    "publishPath": "./out"
  }')
echo "Response: $response"
echo ""

# Deploy hvac-demo
echo "📦 Deploying r3-hvac-demo..."
response=$(curl -s -X POST "https://api.render.com/v1/static-sites" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r3-hvac-demo",
    "repo": "https://github.com/MarcusRawlins/hvac-demo",
    "autoDeploy": true,
    "branch": "main",
    "buildCommand": "npm install && npm run build",
    "publishPath": "./out"
  }')
echo "Response: $response"
echo ""

# Deploy landscaping-demo
echo "📦 Deploying r3-landscaping-demo..."
response=$(curl -s -X POST "https://api.render.com/v1/static-sites" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r3-landscaping-demo",
    "repo": "https://github.com/MarcusRawlins/landscaping-demo",
    "autoDeploy": true,
    "branch": "main",
    "buildCommand": "npm install && npm run build",
    "publishPath": "./out"
  }')
echo "Response: $response"
echo ""

# Deploy maple-bistro-demo
echo "📦 Deploying r3-maple-bistro-demo..."
response=$(curl -s -X POST "https://api.render.com/v1/static-sites" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "r3-maple-bistro-demo",
    "repo": "https://github.com/MarcusRawlins/maple-bistro-demo",
    "autoDeploy": true,
    "branch": "main",
    "buildCommand": "npm install && npm run build",
    "publishPath": "./out"
  }')
echo "Response: $response"
echo ""

echo "✨ Deployment attempts complete!"
