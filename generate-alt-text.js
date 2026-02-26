#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LMSTUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';
const IMAGE_DIR = '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal/';
const OUTPUT_FILE = path.join(IMAGE_DIR, 'alt-text.json');

// Get all image files
const imageFiles = fs.readdirSync(IMAGE_DIR)
  .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .sort();

console.log(`Found ${imageFiles.length} images to process`);

// Function to encode image to base64
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

// Function to get file extension
function getImageType(filename) {
  const ext = path.extname(filename).toLowerCase().substring(1);
  return ext === 'jpg' ? 'jpeg' : ext;
}

// Function to extract clean description from vision model response
function extractCleanDescription(response) {
  let text = response.trim();
  
  // Remove common patterns that indicate multiple options
  text = text.replace(/^Here are a few options.*?:/i, '');
  text = text.replace(/^Option \d+:\s*/gim, '');
  text = text.replace(/^-\s*/gm, '');
  text = text.replace(/^\d+\.\s*/gm, '');
  
  // Split by newlines and take the first non-empty line
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) return text.trim();
  
  // Return the first substantial line (likely the best description)
  return lines[0];
}

// Function to generate alt text for a single image
async function generateAltText(imagePath, filename) {
  const base64Image = imageToBase64(imagePath);
  const imageType = getImageType(filename);
  
  const payload = {
    model: "qwen/qwen3-vl-8b",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Write a single descriptive alt text sentence for this image. No options, no commentary, just the description."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/${imageType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 150,
    temperature: 0.3
  };

  try {
    const response = await fetch(LMSTUDIO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rawDescription = data.choices[0].message.content;
    const cleanDescription = extractCleanDescription(rawDescription);
    
    console.log(`✓ ${filename}`);
    return cleanDescription;
  } catch (error) {
    console.error(`✗ Failed for ${filename}:`, error.message);
    return null;
  }
}

// Main processing function
async function processAllImages() {
  const altTextMap = {};
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const filename = imageFiles[i];
    const imagePath = path.join(IMAGE_DIR, filename);
    
    console.log(`[${i + 1}/${imageFiles.length}] Processing ${filename}...`);
    
    const altText = await generateAltText(imagePath, filename);
    
    if (altText) {
      altTextMap[filename] = altText;
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Write the results to JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(altTextMap, null, 2), 'utf8');
  
  console.log(`\n✅ Complete!`);
  console.log(`   Success: ${successCount}/${imageFiles.length}`);
  console.log(`   Failed: ${failCount}/${imageFiles.length}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

// Run the script
processAllImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
