#!/usr/bin/env python3
"""
Generate alt text for engagement session blog images using local vision model.
Uses qwen3-vl-8b at http://127.0.0.1:1234/v1
Works with actual image files on disk.
"""

import json
import os
import base64
from pathlib import Path
import requests
import re

# Local vision model endpoint
VISION_API_URL = "http://127.0.0.1:1234/v1/chat/completions"

# Base directory for engagement sessions
BASE_DIR = "/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions"

# All 7 blog directories with their location context
BLOG_CONFIGS = [
    {
        "dir": "1-alyssa-jason-engagement",
        "location": "Beacon Hill engagement photos",
        "context": "Beacon Hill, Boston"
    },
    {
        "dir": "2-trish-mario-engagement",
        "location": "Charlotte engagement photos",
        "context": "Charlotte, NC"
    },
    {
        "dir": "3-nicole-jon-engagement",
        "location": "Brooklyn engagement photos",
        "context": "Brooklyn, NY"
    },
    {
        "dir": "4-britton-manor-proposal",
        "location": "Britton Manor proposal photos",
        "context": "Britton Manor proposal"
    },
    {
        "dir": "5-galit-ari-engagement-party",
        "location": "Brooklyn engagement party photos",
        "context": "Brooklyn engagement party"
    },
    {
        "dir": "6-kelly-ryan-engagement",
        "location": "NYC engagement photos",
        "context": "New York City"
    },
    {
        "dir": "7. ellie & maggie Engagement Session",
        "location": "Boston engagement photos",
        "context": "Boston, MA"
    }
]


def encode_image(image_path):
    """Encode image to base64."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


def generate_alt_text_with_vision(image_path, location_context):
    """Generate alt text using local vision model."""
    
    print(f"    🔍 Analyzing with vision model...")
    
    # Encode the image
    try:
        base64_image = encode_image(image_path)
    except Exception as e:
        print(f"    ❌ Failed to encode image: {e}")
        return None
    
    # Create the prompt
    prompt = f"""Describe this engagement or proposal photo in 125 characters or less.

Requirements:
- Describe what you ACTUALLY SEE in the photo
- Include this location: "{location_context}"
- Follow pattern: "Couple [action] [location detail] during their {location_context}"
- Max 125 characters total
- NO generic adjectives like 'beautiful', 'stunning', 'romantic', or 'intimate'
- Be specific about what's happening in the frame
- Use "couple" not names

Examples:
- "Couple sits on navy velvet banquette at bar during their Beacon Hill engagement photos"
- "He leans in to kiss her cheek at the bar during their Charlotte engagement session"
- "Couple walks hand-in-hand down cobblestone alley during their Brooklyn engagement photos"

Return ONLY the alt text description, nothing else."""

    # Call the local vision model
    try:
        response = requests.post(
            VISION_API_URL,
            json={
                "model": "qwen/qwen3-vl-8b",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
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
        
        if response.status_code == 200:
            result = response.json()
            alt_text = result['choices'][0]['message']['content'].strip()
            # Remove quotes if present
            alt_text = alt_text.strip('"').strip("'").strip()
            
            # Ensure it's under 125 characters
            if len(alt_text) > 125:
                alt_text = alt_text[:122] + "..."
            
            return alt_text
        else:
            print(f"    ❌ API error: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return None


def process_blog_directory(config):
    """Process a single blog directory."""
    blog_dir = config["dir"]
    location_context = config["location"]
    
    blog_path = Path(BASE_DIR) / blog_dir
    alt_text_path = blog_path / "alt-text.json"
    
    if not alt_text_path.exists():
        print(f"⚠️  No alt-text.json found in {blog_dir}")
        return 0
    
    print(f"\n📸 Processing: {blog_dir}")
    print(f"   Location: {location_context}")
    
    # Read existing alt-text.json
    with open(alt_text_path, 'r') as f:
        alt_data = json.load(f)
    
    # Find all actual image files
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.JPG', '*.JPEG']:
        image_files.extend(blog_path.glob(ext))
    
    image_files = sorted([f for f in image_files if not f.name.startswith('.')])
    
    print(f"   Found {len(image_files)} images on disk")
    
    # Check what's in alt-text.json
    existing_keys = [k for k in alt_data.keys() if not k.startswith('_')]
    print(f"   Found {len(existing_keys)} entries in alt-text.json")
    
    images_processed = 0
    new_alt_data = {}
    
    # Copy metadata fields
    for key in alt_data.keys():
        if key.startswith('_'):
            new_alt_data[key] = alt_data[key]
    
    # Process each actual image file
    for i, image_path in enumerate(image_files, 1):
        filename = image_path.name
        print(f"\n  [{i}/{len(image_files)}] {filename}")
        
        # Generate alt text using vision model
        alt_text = generate_alt_text_with_vision(str(image_path), location_context)
        
        if alt_text:
            new_alt_data[filename] = alt_text
            images_processed += 1
            print(f"    ✅ {alt_text}")
        else:
            new_alt_data[filename] = "[REVIEW IMAGE AND ADD ALT TEXT]"
            print(f"    ⚠️  Using placeholder")
    
    # Save updated alt-text.json
    if images_processed > 0:
        with open(alt_text_path, 'w') as f:
            json.dump(new_alt_data, f, indent=2)
        print(f"\n  💾 Saved {images_processed} alt text descriptions to {blog_dir}")
    
    return images_processed


def main():
    """Main processing function."""
    print("🚀 Starting alt text generation using local vision model")
    print(f"📍 Vision API: {VISION_API_URL}")
    print(f"📍 Model: qwen3-vl-8b\n")
    
    total_processed = 0
    
    for config in BLOG_CONFIGS:
        count = process_blog_directory(config)
        total_processed += count
    
    print(f"\n✨ Complete! Generated alt text for {total_processed} images across {len(BLOG_CONFIGS)} blogs")
    print(f"💰 Cost: $0 (all local processing)")


if __name__ == "__main__":
    main()
