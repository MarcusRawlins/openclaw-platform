#!/usr/bin/env python3
import base64
import requests
import sys

def test_vision_model():
    image_path = "/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal/britton-manor-engagement-proposal-photos-before-moment-01.jpg"
    
    print("Reading image...")
    with open(image_path, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode('utf-8')
    
    print(f"Image encoded, length: {len(base64_image)}")
    
    print("\nTesting gemma-3-12b-it...")
    
    payload = {
        "model": "gemma-3-12b-it",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this image in one sentence."
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
        "temperature": 0.7
    }
    
    print("Sending request...")
    try:
        response = requests.post("http://127.0.0.1:1234/v1/chat/completions", json=payload, timeout=60)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAlt text: {result['choices'][0]['message']['content']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_vision_model()
