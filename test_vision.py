#!/usr/bin/env python3
import base64
import requests
from pathlib import Path

# Test with one image
test_image = Path("/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/1-alyssa-jason-engagement/Alyssa & Jason Beacon Hill Boston Engagement Session _ The Reeses-1.jpg")

print(f"Testing vision model with: {test_image.name}")
print(f"Image exists: {test_image.exists()}")

if test_image.exists():
    # Encode image
    with open(test_image, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode('utf-8')
    
    print(f"Image encoded: {len(base64_image)} characters")
    
    # Call vision API
    print("Calling vision API...")
    
    response = requests.post(
        "http://127.0.0.1:1234/v1/chat/completions",
        json={
            "model": "qwen/qwen3-vl-8b",  # Fixed model ID
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Describe this engagement photo in one short sentence."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 100,
            "temperature": 0.3
        },
        timeout=60
    )
    
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Alt text: {result['choices'][0]['message']['content']}")
    else:
        print(f"Error: {response.text}")
