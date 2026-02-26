#!/usr/bin/env python3
"""Generate alt text for blog images"""

import json
import base64
import requests
from pathlib import Path

def log(msg):
    print(msg, flush=True)

def encode_image(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

def generate_alt(image_path, model="gemma-3-12b-it"):
    """Generate alt text for one image"""
    try:
        log(f"  Encoding {Path(image_path).name}...")
        b64 = encode_image(image_path)
        
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this wedding/engagement photograph in 1-2 concise sentences for alt text. Focus on: who (couple/people), what they're doing, setting/location, mood/emotion, and key visual details. Be specific but succinct for SEO and accessibility."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                ]
            }],
            "max_tokens": 150,
            "temperature": 0.7
        }
        
        log(f"  Sending to LM Studio ({model})...")
        resp = requests.post("http://127.0.0.1:1234/v1/chat/completions", json=payload, timeout=90)
        resp.raise_for_status()
        
        alt_text = resp.json()['choices'][0]['message']['content'].strip().replace('\n', ' ')
        log(f"  ✓ {alt_text[:60]}...")
        return alt_text
        
    except Exception as e:
        err = f"Error: {str(e)}"
        log(f"  ✗ {err}")
        return err

def process_britton_manor():
    """Process Britton Manor with gemma"""
    base = Path("/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal")
    alt_file = base / "alt-text.json"
    
    # Load existing
    alt_texts = json.loads(alt_file.read_text()) if alt_file.exists() else {}
    
    # Get images
    images = sorted([f.name for f in base.glob("*.jpg")])
    
    log("=" * 80)
    log(f"BRITTON MANOR: {len(images)} images")
    log(f"Model: gemma-3-12b-it")
    log("=" * 80)
    
    done, errors = 0, 0
    
    for img in images:
        if img in alt_texts and not alt_texts[img].startswith("Error"):
            log(f"✓ {img}: Already done")
            continue
        
        log(f"\n{img}")
        alt = generate_alt(str(base / img), "gemma-3-12b-it")
        alt_texts[img] = alt
        
        # Save after each
        alt_file.write_text(json.dumps(alt_texts, indent=2))
        
        if alt.startswith("Error"):
            errors += 1
        else:
            done += 1
    
    log("\n" + "=" * 80)
    log(f"Britton Manor: {done} done, {errors} errors")
    log("=" * 80)
    return done, errors

def audit_other_blogs():
    """Audit other blogs with qwen"""
    base = Path("/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions")
    
    # Get all dirs except Britton Manor
    dirs = sorted([d for d in base.iterdir() if d.is_dir() and "britton" not in d.name.lower()])
    
    log("\n" + "=" * 80)
    log(f"OTHER BLOGS: {len(dirs)} posts")
    log("Model: qwen/qwen3-vl-8b")
    log("=" * 80)
    
    total_done, total_skip, total_err = 0, 0, 0
    
    for post_dir in dirs:
        alt_file = post_dir / "alt-text.json"
        alt_texts = json.loads(alt_file.read_text()) if alt_file.exists() else {}
        
        images = sorted([f.name for f in post_dir.glob("*.jpg")])
        if not images:
            continue
        
        log(f"\n{post_dir.name}: {len(images)} images")
        
        done, skip = 0, 0
        for img in images:
            if img in alt_texts and not alt_texts[img].startswith("Error"):
                skip += 1
                continue
            
            log(f"  {img}")
            alt = generate_alt(str(post_dir / img), "qwen/qwen3-vl-8b")
            alt_texts[img] = alt
            
            alt_file.write_text(json.dumps(alt_texts, indent=2))
            
            if alt.startswith("Error"):
                total_err += 1
            else:
                done += 1
        
        total_done += done
        total_skip += skip
        
        if done > 0:
            log(f"  → {done} generated, {skip} skipped")
    
    log("\n" + "=" * 80)
    log(f"Other blogs: {total_done} done, {total_skip} skipped, {total_err} errors")
    log("=" * 80)
    return total_done, total_skip, total_err

if __name__ == "__main__":
    log("ALT TEXT GENERATOR STARTING\n")
    
    # Step 1: Britton Manor
    b_done, b_err = process_britton_manor()
    
    # Step 2: Other blogs
    o_done, o_skip, o_err = audit_other_blogs()
    
    # Summary
    log("\n" + "=" * 80)
    log("FINAL SUMMARY")
    log("=" * 80)
    log(f"Britton Manor: {b_done} generated, {b_err} errors")
    log(f"Other blogs: {o_done} generated, {o_skip} skipped, {o_err} errors")
    log(f"\nTotal generated: {b_done + o_done}")
    log("=" * 80)
