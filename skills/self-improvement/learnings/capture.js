const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const LEARNINGS_PATH = path.join(config.learnings_dir, 'LEARNINGS.md');
const ERRORS_PATH = path.join(config.learnings_dir, 'ERRORS.md');
const FEATURES_PATH = path.join(config.learnings_dir, 'FEATURE_REQUESTS.md');

class LearningsCapture {
  // Capture a correction from user feedback
  static addCorrection({ context, lesson, applied, agent = 'marcus' }) {
    const date = new Date().toISOString().split('T')[0];
    const entry = `
### Correction: ${lesson.substring(0, 60)}
- **Context:** ${context}
- **Lesson:** ${lesson}
- **Applied:** ${applied || 'Pending'}
- **Agent:** ${agent}
- **Date:** ${date}
`;
    appendToSection(LEARNINGS_PATH, date, entry);
  }

  // Capture an insight
  static addInsight({ context, lesson, applied, agent = 'marcus' }) {
    const date = new Date().toISOString().split('T')[0];
    const entry = `
### Insight: ${lesson.substring(0, 60)}
- **Context:** ${context}
- **Lesson:** ${lesson}
- **Applied:** ${applied || 'Noted'}
- **Agent:** ${agent}
- **Date:** ${date}
`;
    appendToSection(LEARNINGS_PATH, date, entry);
  }

  // Get recent learnings
  static getRecent(days = 7) {
    if (!fs.existsSync(LEARNINGS_PATH)) return [];
    const content = fs.readFileSync(LEARNINGS_PATH, 'utf8');
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    
    // Parse sections by date and filter
    const sections = content.split(/^## (\d{4}-\d{2}-\d{2})/m);
    const recent = [];
    
    for (let i = 1; i < sections.length; i += 2) {
      const date = sections[i];
      if (date >= cutoff) {
        recent.push({ date, entries: sections[i + 1] });
      }
    }
    
    return recent;
  }

  // Search learnings by keyword
  static search(keyword) {
    if (!fs.existsSync(LEARNINGS_PATH)) return [];
    const content = fs.readFileSync(LEARNINGS_PATH, 'utf8');
    const lines = content.split('\n');
    const results = [];
    let currentEntry = null;

    for (const line of lines) {
      if (line.startsWith('### ')) {
        if (currentEntry && currentEntry.text.toLowerCase().includes(keyword.toLowerCase())) {
          results.push(currentEntry);
        }
        currentEntry = { title: line, text: line };
      } else if (currentEntry) {
        currentEntry.text += '\n' + line;
      }
    }
    
    if (currentEntry && currentEntry.text.toLowerCase().includes(keyword.toLowerCase())) {
      results.push(currentEntry);
    }

    return results;
  }
}

function appendToSection(filePath, date, entry) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  } else {
    content = `# ${path.basename(filePath, '.md')}\n`;
  }

  const sectionHeader = `## ${date}`;
  if (content.includes(sectionHeader)) {
    // Append to existing date section
    content = content.replace(sectionHeader, sectionHeader + '\n' + entry);
  } else {
    // Add new date section at the top (after title)
    const titleEnd = content.indexOf('\n') + 1;
    content = content.substring(0, titleEnd) + '\n' + sectionHeader + '\n' + entry + content.substring(titleEnd);
  }

  fs.writeFileSync(filePath, content);
}

module.exports = LearningsCapture;
