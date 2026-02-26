#!/usr/bin/env python3
"""
PDF Text Extraction Script
Extracts text from all PDFs in the knowledge base inventory
"""

import json
import os
from datetime import datetime
from pathlib import Path
import PyPDF2
import sys

def extract_pdf_text(pdf_path):
    """Extract text from a PDF file using PyPDF2"""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # Check if PDF is encrypted/password protected
            if pdf_reader.is_encrypted:
                return None, "password_protected", 0, 0
            
            num_pages = len(pdf_reader.pages)
            text_content = []
            
            for page_num in range(num_pages):
                try:
                    page = pdf_reader.pages[page_num]
                    text_content.append(page.extract_text())
                except Exception as e:
                    print(f"  Warning: Error extracting page {page_num + 1}: {str(e)}")
            
            full_text = "\n\n".join(text_content)
            char_count = len(full_text)
            
            return full_text, "success", num_pages, char_count
            
    except PyPDF2.errors.PdfReadError as e:
        return None, "corrupted", 0, 0
    except Exception as e:
        return None, f"error: {str(e)}", 0, 0

def create_markdown_output(pdf_path, text, pages, chars, extraction_date):
    """Create markdown file with YAML frontmatter"""
    filename = os.path.basename(pdf_path)
    
    markdown_content = f"""---
source: {filename}
source_path: {pdf_path}
extraction_date: {extraction_date}
page_count: {pages}
character_count: {chars}
---

# Extracted Text from {filename}

{text if text else "[No text content extracted]"}
"""
    
    return markdown_content

def main():
    # Load inventory
    inventory_path = "/Volumes/reeseai-memory/data/knowledge-base/inventory.json"
    print(f"Loading inventory from {inventory_path}...")
    
    with open(inventory_path, 'r') as f:
        inventory = json.load(f)
    
    pdf_files = [item for item in inventory['files'] if item['type'] == 'pdf']
    total_pdfs = len(pdf_files)
    
    print(f"Found {total_pdfs} PDFs to process\n")
    
    # Results tracking
    results = {
        "total": total_pdfs,
        "successful": 0,
        "failed": 0,
        "needs_ocr": 0,
        "password_protected": 0,
        "corrupted": 0,
        "files": []
    }
    
    extraction_date = datetime.now().isoformat()
    
    # Priority order based on category/path
    priority_order = [
        "the-marketing-lab",
        "six-figure-photography",
        "find-in-a-box",
        "guides",
        "posing-and-shooting"
    ]
    
    # Sort PDFs by priority
    def get_priority(pdf_item):
        path = pdf_item['path'].lower()
        for i, keyword in enumerate(priority_order):
            if keyword in path:
                return i
        return len(priority_order)
    
    pdf_files_sorted = sorted(pdf_files, key=get_priority)
    
    # Process each PDF
    for idx, pdf_item in enumerate(pdf_files_sorted, 1):
        pdf_path = pdf_item['path']
        filename = pdf_item['filename']
        size_bytes = pdf_item['size_bytes']
        
        print(f"[{idx}/{total_pdfs}] Processing: {filename}")
        print(f"  Path: {pdf_path}")
        print(f"  Size: {size_bytes:,} bytes")
        
        # Check if file exists
        if not os.path.exists(pdf_path):
            print(f"  ❌ File not found!")
            results["failed"] += 1
            results["files"].append({
                "path": pdf_path,
                "filename": filename,
                "status": "file_not_found",
                "pages": 0,
                "chars": 0,
                "output": None,
                "size_bytes": size_bytes
            })
            continue
        
        # Extract text
        text, status, pages, chars = extract_pdf_text(pdf_path)
        
        # Determine output path
        output_path = pdf_path.replace('.pdf', '.extracted.md')
        
        # Handle different statuses
        if status == "password_protected":
            print(f"  🔒 Password protected")
            results["password_protected"] += 1
            results["failed"] += 1
            results["files"].append({
                "path": pdf_path,
                "filename": filename,
                "status": "password_protected",
                "pages": 0,
                "chars": 0,
                "output": None,
                "size_bytes": size_bytes
            })
        
        elif status == "corrupted":
            print(f"  💥 Corrupted or unreadable")
            results["corrupted"] += 1
            results["failed"] += 1
            results["files"].append({
                "path": pdf_path,
                "filename": filename,
                "status": "corrupted",
                "pages": 0,
                "chars": 0,
                "output": None,
                "size_bytes": size_bytes
            })
        
        elif status.startswith("error"):
            print(f"  ❌ {status}")
            results["failed"] += 1
            results["files"].append({
                "path": pdf_path,
                "filename": filename,
                "status": status,
                "pages": 0,
                "chars": 0,
                "output": None,
                "size_bytes": size_bytes
            })
        
        else:
            # Check if needs OCR (image-heavy PDF)
            if chars < 100 and size_bytes > 100000:
                print(f"  ⚠️  Likely image-heavy PDF (needs OCR): {chars} chars from {size_bytes:,} bytes")
                results["needs_ocr"] += 1
                file_status = "needs_ocr"
            else:
                print(f"  ✅ Extracted: {pages} pages, {chars:,} characters")
                results["successful"] += 1
                file_status = "success"
            
            # Create and save markdown file
            markdown_content = create_markdown_output(
                pdf_path, text, pages, chars, extraction_date
            )
            
            try:
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(markdown_content)
                print(f"  💾 Saved to: {output_path}")
            except Exception as e:
                print(f"  ❌ Error saving output: {str(e)}")
                file_status = f"error_saving: {str(e)}"
            
            results["files"].append({
                "path": pdf_path,
                "filename": filename,
                "status": file_status,
                "pages": pages,
                "chars": chars,
                "output": output_path,
                "size_bytes": size_bytes
            })
        
        print()
    
    # Save extraction report
    report_path = "/Volumes/reeseai-memory/data/knowledge-base/pdf-extraction-report.json"
    print(f"Saving extraction report to {report_path}...")
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Create summary markdown
    summary_path = "/Volumes/reeseai-memory/data/knowledge-base/pdf-extraction-summary.md"
    print(f"Creating summary at {summary_path}...")
    
    # Calculate statistics
    success_rate = (results["successful"] / results["total"] * 100) if results["total"] > 0 else 0
    
    # Group by category
    categories = {}
    for file_result in results["files"]:
        path = file_result["path"]
        if "the-marketing-lab" in path:
            cat = "Marketing Lab"
        elif "six-figure-photography" in path:
            cat = "Six Figure Photography"
        elif "find-in-a-box" in path:
            cat = "Film in a Box"
        elif "guides" in path:
            cat = "Guides"
        elif "email-templates" in path:
            cat = "Email Templates"
        elif "timelines" in path:
            cat = "Timeline Templates"
        else:
            cat = "Other Resources"
        
        if cat not in categories:
            categories[cat] = {"success": 0, "needs_ocr": 0, "failed": 0, "total": 0}
        
        categories[cat]["total"] += 1
        if file_result["status"] == "success":
            categories[cat]["success"] += 1
        elif file_result["status"] == "needs_ocr":
            categories[cat]["needs_ocr"] += 1
        else:
            categories[cat]["failed"] += 1
    
    summary_md = f"""# PDF Extraction Summary

**Extraction Date:** {extraction_date}

## Overview Statistics

- **Total PDFs:** {results["total"]}
- **Successfully Extracted:** {results["successful"]} ({success_rate:.1f}%)
- **Needs OCR (Image-heavy):** {results["needs_ocr"]}
- **Failed:** {results["failed"]}
  - Password Protected: {results["password_protected"]}
  - Corrupted: {results["corrupted"]}
  - Other Errors: {results["failed"] - results["password_protected"] - results["corrupted"]}

## Results by Category

"""
    
    for cat, stats in sorted(categories.items()):
        summary_md += f"""### {cat}
- Total: {stats["total"]}
- Successful: {stats["success"]}
- Needs OCR: {stats["needs_ocr"]}
- Failed: {stats["failed"]}

"""
    
    summary_md += """## Files Needing OCR

These PDFs appear to be image-heavy (scanned documents or graphics) and need OCR processing:

"""
    
    ocr_files = [f for f in results["files"] if f["status"] == "needs_ocr"]
    if ocr_files:
        for f in ocr_files:
            summary_md += f"- `{f['filename']}` ({f['size_bytes']:,} bytes, {f['chars']} chars extracted)\n"
    else:
        summary_md += "*None*\n"
    
    summary_md += """
## Failed Extractions

"""
    
    failed_files = [f for f in results["files"] if f["status"] not in ["success", "needs_ocr"]]
    if failed_files:
        for f in failed_files:
            summary_md += f"- `{f['filename']}` - Status: {f['status']}\n"
    else:
        summary_md += "*None*\n"
    
    summary_md += f"""
## Next Steps

1. **OCR Processing:** {results["needs_ocr"]} PDFs need OCR to extract text from images
2. **Review Failed:** {results["failed"]} PDFs failed extraction and should be reviewed
3. **Text Available:** {results["successful"]} PDFs have extracted text ready for indexing

## Output Files

All extracted text has been saved as `.extracted.md` files alongside the original PDFs:
- Format: `document.pdf` → `document.extracted.md`
- Contains: YAML frontmatter with metadata + extracted text
- Location: Same directory as source PDF

Full extraction report: `/Volumes/reeseai-memory/data/knowledge-base/pdf-extraction-report.json`
"""
    
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write(summary_md)
    
    # Print final summary
    print("\n" + "="*70)
    print("EXTRACTION COMPLETE")
    print("="*70)
    print(f"Total PDFs: {results['total']}")
    print(f"✅ Successful: {results['successful']} ({success_rate:.1f}%)")
    print(f"⚠️  Needs OCR: {results['needs_ocr']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"   - Password protected: {results['password_protected']}")
    print(f"   - Corrupted: {results['corrupted']}")
    print("\nReports saved:")
    print(f"  - {report_path}")
    print(f"  - {summary_path}")
    print("="*70)

if __name__ == "__main__":
    main()
