#!/usr/bin/env python3
import base64
import json
import requests

# Test with first image
image_path = "/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal/britton-manor-engagement-proposal-photos-before-moment-01.jpg"

# Read and encode
with open(image_path, "rb") as f:
    base64_image = base64.b64encode(f.read()).decode('utf-8')

print(f"Image size: {len(base64_image)} chars")

# Test payload
payload = {
    "model": "qwen/qwen3-vl-8b",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                },
                {
                    "type": "text",
                    "text": "Describe this wedding/engagement photo in one sentence for use as alt text. Be specific. Under 125 characters."
                }
            ]
        }
    ],
    "max_tokens": 100,
    "temperature": 0.7
}

print("\nSending request to LM Studio...")
try:
    response = requests.post("http://127.0.0.1:1234/v1/chat/completions", json=payload, timeout=60)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response text: {e.response.text}")
