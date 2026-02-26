const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const FEATURES_PATH = path.join(config.learnings_dir, 'FEATURE_REQUESTS.md');

class FeatureLog {
  static add({ title, description, source, priority = 'medium', status = 'proposed' }) {
    const date = new Date().toISOString().split('T')[0];
    const id = `FR-${Date.now().toString(36).toUpperCase()}`;
    
    const entry = `
### ${id}: ${title}
- **Status:** ${status}
- **Priority:** ${priority}
- **Source:** ${source}
- **Date:** ${date}
- **Description:** ${description}
`;

    let content = '';
    if (fs.existsSync(FEATURES_PATH)) {
      content = fs.readFileSync(FEATURES_PATH, 'utf8');
    } else {
      content = '# Feature Requests\n\n## Proposed\n';
    }

    // Append to Proposed section
    if (content.includes('## Proposed')) {
      content = content.replace('## Proposed', '## Proposed\n' + entry);
    } else {
      content += '\n## Proposed\n' + entry;
    }

    fs.writeFileSync(FEATURES_PATH, content);
    return id;
  }

  static updateStatus(id, newStatus) {
    if (!fs.existsSync(FEATURES_PATH)) return false;
    let content = fs.readFileSync(FEATURES_PATH, 'utf8');
    
    const pattern = new RegExp(`(### ${id}[^]*?- \\*\\*Status:\\*\\* )\\w+`, 'm');
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${newStatus}`);
      fs.writeFileSync(FEATURES_PATH, content);
      return true;
    }
    return false;
  }

  static list(statusFilter = null) {
    if (!fs.existsSync(FEATURES_PATH)) return [];
    const content = fs.readFileSync(FEATURES_PATH, 'utf8');
    
    const entries = [];
    const entryPattern = /### (FR-\w+): (.+)\n- \*\*Status:\*\* (\w+)\n- \*\*Priority:\*\* (\w+)/g;
    let match;
    
    while ((match = entryPattern.exec(content))) {
      const entry = { id: match[1], title: match[2], status: match[3], priority: match[4] };
      if (!statusFilter || entry.status === statusFilter) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
}

module.exports = FeatureLog;
