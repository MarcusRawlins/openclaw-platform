/**
 * Daily Notes Manager
 * Append-only daily note system for agents and Marcus
 * Daily notes are permanent archive; never edited or deleted
 */

const fs = require('fs');
const path = require('path');

class DailyNotesManager {
  constructor(agentId = 'main') {
    this.agentId = agentId;
    this.basePath = this.getBasePath(agentId);
  }

  /**
   * Get base path for daily notes
   */
  getBasePath(agentId) {
    if (agentId === 'main' || agentId === 'marcus') {
      return '/Users/marcusrawlins/.openclaw/workspace/memory';
    }
    return `/Users/marcusrawlins/.openclaw/agents/${agentId}/memory`;
  }

  /**
   * Get path to daily note file for a given date
   */
  getNotePath(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.basePath, `${dateStr}.md`);
  }

  /**
   * Append an entry to today's daily notes
   */
  append(content) {
    const notePath = this.getNotePath();

    // Create directory if needed
    fs.mkdirSync(path.dirname(notePath), { recursive: true });

    // Format timestamp
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });

    const entry = `\n## ${timestamp}\n${content}\n`;

    // Create file if new, or append
    if (fs.existsSync(notePath)) {
      fs.appendFileSync(notePath, entry, 'utf-8');
    } else {
      const dateStr = new Date().toISOString().split('T')[0];
      const header = `# ${dateStr} — Daily Notes (${this.agentId})\n`;
      fs.writeFileSync(notePath, header + entry, 'utf-8');
    }

    return notePath;
  }

  /**
   * Get recent daily notes (configurable days back)
   */
  getRecentNotes(days = 7) {
    const notes = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const notePath = this.getNotePath(date);

      if (fs.existsSync(notePath)) {
        notes.push({
          date: dateStr,
          path: notePath,
          content: fs.readFileSync(notePath, 'utf-8')
        });
      }
    }

    return notes;
  }

  /**
   * Get a specific day's notes
   */
  getNotesByDate(dateStr) {
    const date = new Date(dateStr);
    const notePath = this.getNotePath(date);

    if (!fs.existsSync(notePath)) {
      return null;
    }

    return {
      date: dateStr,
      path: notePath,
      content: fs.readFileSync(notePath, 'utf-8')
    };
  }

  /**
   * Archive notes older than maxAgeDays
   * Organizes by YYYY-MM folder in archive
   */
  archiveOldNotes(maxAgeDays = 30) {
    if (!fs.existsSync(this.basePath)) {
      return { archived: 0, errors: [] };
    }

    const archiveBase = this.agentId === 'main' || this.agentId === 'marcus'
      ? '/Volumes/reeseai-memory/agents/marcus/memory-archive'
      : `/Volumes/reeseai-memory/agents/${this.agentId}/memory-archive`;

    fs.mkdirSync(archiveBase, { recursive: true });

    const files = fs.readdirSync(this.basePath)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));

    let archived = 0;
    const errors = [];

    for (const file of files) {
      const dateStr = file.replace('.md', '');
      const filePath = path.join(this.basePath, file);
      const fileDate = new Date(dateStr);
      const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > maxAgeDays) {
        try {
          // Organize by month in archive
          const month = dateStr.substring(0, 7); // YYYY-MM
          const monthDir = path.join(archiveBase, month);
          fs.mkdirSync(monthDir, { recursive: true });

          // Copy file to archive
          const archivePath = path.join(monthDir, file);
          fs.copyFileSync(filePath, archivePath);

          // DON'T delete original - daily notes are permanent
          // But mark as archived so boot loader won't load it
          archived++;
        } catch (err) {
          errors.push(`Failed to archive ${file}: ${err.message}`);
        }
      }
    }

    return { archived, errors };
  }

  /**
   * Get statistics about notes
   */
  getStats() {
    if (!fs.existsSync(this.basePath)) {
      return {
        totalFiles: 0,
        oldestDate: null,
        newestDate: null,
        totalBytes: 0
      };
    }

    const files = fs.readdirSync(this.basePath)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort();

    let totalBytes = 0;
    for (const file of files) {
      const stat = fs.statSync(path.join(this.basePath, file));
      totalBytes += stat.size;
    }

    return {
      totalFiles: files.length,
      oldestDate: files.length > 0 ? files[0].replace('.md', '') : null,
      newestDate: files.length > 0 ? files[files.length - 1].replace('.md', '') : null,
      totalBytes,
      agentId: this.agentId
    };
  }
}

module.exports = DailyNotesManager;

// CLI for testing
if (require.main === module) {
  const agentId = process.argv[2] || 'main';
  const action = process.argv[3] || 'stats';

  const notes = new DailyNotesManager(agentId);

  if (action === 'append') {
    const content = process.argv[4] || 'Test entry';
    const notePath = notes.append(content);
    console.log(`✓ Appended to ${notePath}`);
  } else if (action === 'recent') {
    const recent = notes.getRecentNotes(7);
    console.log(`\n📝 Recent notes (${recent.length} days):`);
    for (const note of recent) {
      console.log(`  ${note.date}: ${note.content.split('\n').length} lines`);
    }
  } else if (action === 'archive') {
    const result = notes.archiveOldNotes(30);
    console.log(`✓ Archived ${result.archived} old notes`);
    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
  } else {
    const stats = notes.getStats();
    console.log(`\n📊 Daily Notes Stats (${agentId}):`);
    console.log(`  Total files: ${stats.totalFiles}`);
    console.log(`  Oldest: ${stats.oldestDate}`);
    console.log(`  Newest: ${stats.newestDate}`);
    console.log(`  Total size: ${(stats.totalBytes / 1024).toFixed(1)} KB`);
  }
}
