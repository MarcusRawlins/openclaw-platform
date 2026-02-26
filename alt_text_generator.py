#!/usr/bin/env python3
"""
Alt text generator for blog images
Generates descriptive alt text using LM Studio vision models
"""

import json
import os
import sys
import base64
from pathlib import Path
import requests
from typing import Dict, List, Tuple

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions"

def encode_image(image_path: str) -> str:
    """Encode image to base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def generate_alt_text(image_path: str, model: str = "gemma-3-12b-it") -> str:
    """Generate alt text for an image using LM Studio vision model"""
    try:
        # Read image as base64
        base64_image = encode_image(image_path)
        
        # Prepare the request
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Describe this wedding/engagement photograph in 1-2 concise sentences for alt text. Focus on: who (couple/people), what they're doing, setting/location, mood/emotion, and any key visual details (lighting, composition). Be specific and descriptive but succinct. This is for SEO and accessibility."
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
            "max_tokens": 150,
            "temperature": 0.7
        }
        
        response = requests.post(LM_STUDIO_URL, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        alt_text = result['choices'][0]['message']['content'].strip()
        
        # Clean up the alt text
        alt_text = alt_text.replace('\n', ' ').strip()
        
        return alt_text
        
    except Exception as e:
        return f"Error: {str(e)}"

def process_britton_manor():
    """Process Britton Manor images with gemma-3-12b-it"""
    base_path = "/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal"
    alt_text_file = os.path.join(base_path, "alt-text.json")
    
    # Load existing alt text
    if os.path.exists(alt_text_file):
        with open(alt_text_file, 'r') as f:
            alt_texts = json.load(f)
    else:
        alt_texts = {}
    
    # Find all JPG images
    images = sorted([f for f in os.listdir(base_path) if f.endswith('.jpg')])
    
    print(f"Found {len(images)} Britton Manor images")
    print(f"Using model: gemma-3-12b-it")
    print("-" * 80)
    
    processed = 0
    errors = 0
    
    for image_name in images:
        # Skip if already has valid alt text (not an error)
        if image_name in alt_texts and not alt_texts[image_name].startswith("Error"):
            print(f"✓ {image_name}: Already has alt text")
            continue
        
        image_path = os.path.join(base_path, image_name)
        print(f"Processing: {image_name}...")
        
        alt_text = generate_alt_text(image_path, model="gemma-3-12b-it")
        alt_texts[image_name] = alt_text
        
        if alt_text.startswith("Error"):
            print(f"✗ {image_name}: {alt_text}")
            errors += 1
        else:
            print(f"✓ {image_name}: {alt_text[:80]}...")
            processed += 1
        
        # Save after each image
        with open(alt_text_file, 'w') as f:
            json.dump(alt_texts, f, indent=2)
    
    print("-" * 80)
    print(f"Britton Manor complete: {processed} processed, {errors} errors")
    return processed, errors

def audit_blog_post(post_dir: Path, model: str = "qwen/qwen3-vl-8b") -> Tuple[int, int, int]:
    """Audit a single blog post directory for alt text"""
    alt_text_file = post_dir / "alt-text.json"
    
    # Load existing alt text
    if alt_text_file.exists():
        with open(alt_text_file, 'r') as f:
            alt_texts = json.load(f)
    else:
        alt_texts = {}
    
    # Find all JPG images
    images = sorted([f.name for f in post_dir.glob('*.jpg')])
    
    if not images:
        return 0, 0, 0
    
    processed = 0
    skipped = 0
    errors = 0
    
    print(f"\n{post_dir.name}")
    print(f"  Found {len(images)} images")
    
    for image_name in images:
        # Skip if already has valid alt text (not an error)
        if image_name in alt_texts and not alt_texts[image_name].startswith("Error"):
            skipped += 1
            continue
        
        image_path = post_dir / image_name
        print(f"  Processing: {image_name}...")
        
        alt_text = generate_alt_text(str(image_path), model=model)
        alt_texts[image_name] = alt_text
        
        if alt_text.startswith("Error"):
            print(f"  ✗ Error: {alt_text}")
            errors += 1
        else:
            print(f"  ✓ {alt_text[:60]}...")
            processed += 1
        
        # Save after each image
        with open(alt_text_file, 'w') as f:
            json.dump(alt_texts, f, indent=2)
    
    return processed, skipped, errors

def audit_all_blogs():
    """Audit all blog posts for missing alt text"""
    engagement_base = Path("/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions")
    
    # Get all engagement session directories (excluding Britton Manor)
    dirs = sorted([d for d in engagement_base.iterdir() if d.is_dir() and "britton" not in d.name.lower()])
    
    print("\n" + "=" * 80)
    print("AUDITING ALL OTHER BLOG POSTS")
    print(f"Using model: qwen/qwen3-vl-8b")
    print("=" * 80)
    
    total_processed = 0
    total_skipped = 0
    total_errors = 0
    
    for post_dir in dirs:
        processed, skipped, errors = audit_blog_post(post_dir, model="qwen/qwen3-vl-8b")
        total_processed += processed
        total_skipped += skipped
        total_errors += errors
        
        if processed > 0 or errors > 0:
            print(f"  → {processed} generated, {skipped} skipped, {errors} errors")
    
    print("\n" + "=" * 80)
    print(f"AUDIT COMPLETE")
    print(f"Total: {total_processed} generated, {total_skipped} already had alt text, {total_errors} errors")
    print("=" * 80)
    
    return total_processed, total_skipped, total_errors

def main():
    """Main entry point"""
    print("=" * 80)
    print("ALT TEXT GENERATOR")
    print("=" * 80)
    
    # Step 1: Process Britton Manor with gemma-3-12b-it
    print("\nSTEP 1: BRITTON MANOR IMAGES")
    print("Model: gemma-3-12b-it")
    print("-" * 80)
    britton_processed, britton_errors = process_britton_manor()
    
    # Step 2: Audit all other blog posts with qwen/qwen3-vl-8b
    print("\n\nSTEP 2: ALL OTHER BLOG POSTS")
    print("Model: qwen/qwen3-vl-8b")
    print("-" * 80)
    audit_processed, audit_skipped, audit_errors = audit_all_blogs()
    
    # Final summary
    print("\n\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Britton Manor: {britton_processed} processed, {britton_errors} errors")
    print(f"Other blogs: {audit_processed} processed, {audit_skipped} skipped, {audit_errors} errors")
    print(f"\nGrand total: {britton_processed + audit_processed} alt texts generated")
    print("=" * 80)

if __name__ == "__main__":
    main()
