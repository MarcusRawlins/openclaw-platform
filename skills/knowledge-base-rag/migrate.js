const fs = require('fs');
const path = require('path');
const Ingester = require('./ingest');
const config = require('./config.json');

class KnowledgeBaseMigrator {
  constructor() {
    this.ingester = null;
    this.kb_dir = '/Volumes/reeseai-memory/data/knowledge-base';
    this.processed_file = path.join(this.kb_dir, '.migration-status.json');
  }

  async initialize() {
    this.ingester = await new Ingester().initialize();
    return this;
  }

  // Load inventory of existing KB files
  loadInventory() {
    const inventoryPath = path.join(this.kb_dir, 'inventory.json');
    if (!fs.existsSync(inventoryPath)) {
      throw new Error('inventory.json not found in knowledge-base directory');
    }

    return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  }

  // Get list of files to migrate (prioritize .extracted.md for PDFs, transcript files for videos)
  getFilesToMigrate() {
    const files = [];

    // Load PDF extraction report
    const pdfReportPath = path.join(this.kb_dir, 'pdf-extraction-report.json');
    if (fs.existsSync(pdfReportPath)) {
      const pdfReport = JSON.parse(fs.readFileSync(pdfReportPath, 'utf8'));
      if (pdfReport.files) {
        for (const file of pdfReport.files) {
          if (file.status === 'success' && file.output && fs.existsSync(file.output)) {
            files.push({
              path: file.output,
              title: file.filename || path.basename(file.output),
              type: 'local_pdf',
              tags: ['pdf-extracted'],
              source: file
            });
          }
        }
      }
    }

    // Load video transcription report
    const videoReportPath = path.join(this.kb_dir, 'video-transcription-report-FINAL.json');
    if (fs.existsSync(videoReportPath)) {
      const videoReport = JSON.parse(fs.readFileSync(videoReportPath, 'utf8'));
      if (videoReport.files) {
        for (const file of videoReport.files) {
          if (file.status === 'success' && file.transcript_path && fs.existsSync(file.transcript_path)) {
            files.push({
              path: file.transcript_path,
              title: file.filename || path.basename(file.transcript_path),
              type: 'local_video',
              tags: ['video-transcript'],
              source: file
            });
          }
        }
      }
    }

    // Load markdown files from inventory
    const inventory = this.loadInventory();
    const items = inventory.files || inventory;
    for (const item of items) {
      if (item.type === 'markdown' || item.path?.endsWith('.md')) {
        if (fs.existsSync(item.path)) {
          files.push({
            path: item.path,
            title: item.filename || path.basename(item.path),
            type: 'local_markdown',
            tags: item.category ? [item.category] : [],
            source: item
          });
        }
      }
    }

    return files;
  }

  // Load migration status
  loadMigrationStatus() {
    if (fs.existsSync(this.processed_file)) {
      return JSON.parse(fs.readFileSync(this.processed_file, 'utf8'));
    }
    return { processed: [], failed: [], total: 0 };
  }

  // Save migration status
  saveMigrationStatus(status) {
    fs.writeFileSync(this.processed_file, JSON.stringify(status, null, 2));
  }

  // Perform migration
  async migrate(resumeFromFailed = false) {
    console.log('\n========== Knowledge Base Migration ==========\n');

    const files = this.getFilesToMigrate();
    const status = this.loadMigrationStatus();

    console.log(`Found ${files.length} files to migrate`);
    console.log(`Already processed: ${status.processed.length}`);
    console.log(`Failed: ${status.failed.length}`);

    const filesToProcess = resumeFromFailed
      ? files.filter(f => status.failed.some(failed => failed.path === f.path))
      : files.filter(f => !status.processed.includes(f.path));

    console.log(`Processing: ${filesToProcess.length} files\n`);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const progress = `[${i + 1}/${filesToProcess.length}]`;

      try {
        console.log(`${progress} Migrating: ${file.title}`);

        const result = await this.ingester.ingestLocalFile(file.path, {
          tags: file.tags
        });

        if (result.status === 'success') {
          succeeded++;
          status.processed.push(file.path);
          console.log(`  ✓ Success: ${result.chunks_created} chunks`);
        } else if (result.status === 'skipped') {
          status.processed.push(file.path);
          console.log(`  ⊘ Skipped: ${result.message}`);
        } else {
          failed++;
          status.failed.push({ path: file.path, error: result.error });
          console.log(`  ✗ Failed: ${result.error}`);
        }
      } catch (error) {
        failed++;
        status.failed.push({ path: file.path, error: error.message });
        console.log(`  ✗ Error: ${error.message}`);
      }

      // Save status periodically
      if ((i + 1) % 10 === 0) {
        this.saveMigrationStatus(status);
      }
    }

    // Final status
    this.saveMigrationStatus(status);

    const stats = await this.ingester.db.getStats();

    console.log('\n========== Migration Complete ==========');
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${filesToProcess.length - succeeded - failed}`);
    console.log(`\nDatabase Stats:`);
    console.log(`  Total sources: ${stats.total_sources}`);
    console.log(`  Total chunks: ${stats.total_chunks}`);
    console.log(`  Successful ingestions: ${stats.ingestions_succeeded}`);
    console.log(`  Failed ingestions: ${stats.ingestions_failed}`);

    return {
      succeeded,
      failed,
      stats
    };
  }

  async close() {
    if (this.ingester) await this.ingester.close();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');

  (async () => {
    const migrator = await new KnowledgeBaseMigrator().initialize();
    try {
      const result = await migrator.migrate(resume);
      if (result.failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Migration error:', error.message);
      process.exit(1);
    } finally {
      await migrator.close();
    }
  })();
}

module.exports = KnowledgeBaseMigrator;
