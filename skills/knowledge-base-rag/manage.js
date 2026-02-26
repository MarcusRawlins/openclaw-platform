const KnowledgeBaseDB = require('./db');
const EmbeddingsClient = require('./embeddings');
const Ingester = require('./ingest');
const fs = require('fs');

class KnowledgeBaseManager {
  constructor() {
    this.db = new KnowledgeBaseDB();
    this.embeddings = new EmbeddingsClient();
  }

  // List all sources
  list(options = {}) {
    const sources = this.db.getAllSources();
    const format = options.format || 'table';

    if (format === 'json') {
      return sources.map(s => ({
        id: s.id,
        title: s.title,
        type: s.source_type,
        url: s.url,
        file_path: s.file_path,
        fetched_at: s.fetched_at,
        tags: s.tags ? JSON.parse(s.tags) : []
      }));
    }

    // Table format
    console.log('\n=== Knowledge Base Sources ===\n');
    console.log(`Total sources: ${sources.length}\n`);

    sources.forEach(source => {
      const chunkCount = this.db.getChunkCount(source.id);
      console.log(`[${source.id}] ${source.title}`);
      console.log(`    Type: ${source.source_type}`);
      console.log(`    Chunks: ${chunkCount}`);
      if (source.url) console.log(`    URL: ${source.url}`);
      if (source.file_path) console.log(`    File: ${source.file_path}`);
      console.log(`    Fetched: ${source.fetched_at}`);
      if (source.tags) console.log(`    Tags: ${source.tags}`);
      console.log();
    });

    return sources;
  }

  // Delete source and its chunks
  delete(sourceId, confirm = false) {
    const source = this.db.getSource(sourceId);
    if (!source) {
      return { success: false, message: `Source ${sourceId} not found` };
    }

    const chunkCount = this.db.getChunkCount(sourceId);

    if (!confirm) {
      console.log(`\nSource: ${source.title}`);
      console.log(`Type: ${source.source_type}`);
      console.log(`Chunks: ${chunkCount}`);
      console.log('\nThis action will delete the source and all its chunks (cannot be undone).');
      console.log('To confirm, run with --confirm flag');
      return { success: false, message: 'Deletion cancelled' };
    }

    const success = this.db.deleteSource(sourceId);

    return {
      success,
      message: success
        ? `Deleted source and ${chunkCount} chunks`
        : 'Deletion failed'
    };
  }

  // Reindex (rebuild embeddings)
  async reindex(sourceId = null, options = {}) {
    console.log('\n=== Reindexing Knowledge Base ===\n');

    const sources = sourceId
      ? [this.db.getSource(sourceId)]
      : this.db.getAllSources();

    if (!sources.length) {
      return { success: false, message: 'No sources found' };
    }

    let reindexed = 0;
    let failed = 0;

    for (const source of sources) {
      try {
        console.log(`Reindexing: ${source.title}`);

        const chunks = this.db.getChunksBySource(source.id);
        if (chunks.length === 0) {
          console.log('  ⊘ No chunks found');
          continue;
        }

        // Delete old embeddings
        const stmt = this.db.db.prepare('DELETE FROM chunks WHERE source_id = ?');
        stmt.run(source.id);

        // Regenerate embeddings
        const texts = chunks.map(c => c.text);
        const embeddingResults = await this.embeddings.embedBatch(texts);

        // Store new chunks with embeddings
        const chunksWithEmbeddings = chunks
          .map((chunk, index) => {
            const embedding = embeddingResults.embeddings[index];
            if (!embedding) return null;

            return {
              text: chunk.text,
              embedding: EmbeddingsClient.embeddingToBuffer(embedding),
              token_count: chunk.token_count
            };
          })
          .filter(c => c !== null);

        const storedCount = this.db.addChunks(source.id, chunksWithEmbeddings);

        console.log(`  ✓ Reindexed ${storedCount} chunks`);
        reindexed++;
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        failed++;
      }
    }

    return {
      success: failed === 0,
      reindexed,
      failed,
      message: `Reindexed ${reindexed} sources, ${failed} failed`
    };
  }

  // Health check
  async healthCheck() {
    console.log('\n=== Knowledge Base Health Check ===\n');

    const checks = {
      database: { status: 'unknown', details: '' },
      embeddings: { status: 'unknown', details: '' },
      data_integrity: { status: 'unknown', details: '' }
    };

    // Check database
    try {
      const stats = await this.db.getStats();
      checks.database = {
        status: stats.total_sources > 0 ? 'healthy' : 'empty',
        details: `${stats.total_sources} sources, ${stats.total_chunks} chunks`
      };
    } catch (error) {
      checks.database = { status: 'error', details: error.message };
    }

    // Check embeddings client
    try {
      const healthStatus = await this.embeddings.healthCheck();
      checks.embeddings = {
        status: healthStatus.healthy ? 'healthy' : 'unhealthy',
        details: healthStatus.error || `${healthStatus.models_available} models available`
      };
    } catch (error) {
      checks.embeddings = { status: 'error', details: error.message };
    }

    // Check data integrity
    try {
      const sources = await this.db.getAllSources();
      let orphanedChunks = 0;
      let missingChunks = 0;

      if (sources && Array.isArray(sources)) {
        for (const source of sources) {
          const chunkCount = await this.db.getChunkCount(source.id);
          if (chunkCount === 0) {
            missingChunks++;
          }
        }

        // Count total chunks in DB
        let allChunksTotal = 0;
        for (const source of sources) {
          const count = await this.db.getChunkCount(source.id);
          allChunksTotal += count || 0;
        }

        let associatedChunks = 0;
        for (const source of sources) {
          const count = await this.db.getChunkCount(source.id);
          associatedChunks += count || 0;
        }

        orphanedChunks = allChunksTotal - associatedChunks;
      }

      checks.data_integrity = {
        status: orphanedChunks === 0 && missingChunks === 0 ? 'healthy' : 'issues_found',
        details: `${missingChunks} sources without chunks, ${orphanedChunks} orphaned chunks`
      };
    } catch (error) {
      checks.data_integrity = { status: 'error', details: error.message };
    }

    // Print results
    Object.entries(checks).forEach(([check, result]) => {
      const icon = result.status === 'healthy' ? '✓' : result.status === 'error' ? '✗' : '⚠';
      console.log(`${icon} ${check}: ${result.status}`);
      console.log(`  ${result.details}\n`);
    });

    const allHealthy = Object.values(checks).every(
      check => check.status === 'healthy' || check.status === 'empty'
    );

    return {
      overall_status: allHealthy ? 'healthy' : 'issues_found',
      checks
    };
  }

  // Statistics
  stats() {
    const stats = this.db.getStats();

    console.log('\n=== Knowledge Base Statistics ===\n');
    console.log(`Total sources: ${stats.total_sources}`);
    console.log(`Total chunks: ${stats.total_chunks}`);
    console.log(`Successful ingestions: ${stats.ingestions_succeeded}`);
    console.log(`Failed ingestions: ${stats.ingestions_failed}`);

    if (stats.total_sources > 0) {
      console.log(`Average chunks per source: ${Math.round(stats.total_chunks / stats.total_sources)}`);
    }

    return stats;
  }

  // Cleanup stale entries
  cleanup() {
    console.log('\n=== Cleanup ===\n');

    // Delete sources with no chunks
    const orphanedSources = this.db.db
      .prepare(`
        SELECT s.id, s.title FROM sources s
        WHERE NOT EXISTS (SELECT 1 FROM chunks WHERE source_id = s.id)
      `)
      .all();

    console.log(`Found ${orphanedSources.length} sources with no chunks`);

    let deleted = 0;
    for (const source of orphanedSources) {
      this.db.deleteSource(source.id);
      deleted++;
    }

    console.log(`Deleted ${deleted} orphaned sources\n`);

    return { deleted };
  }

  close() {
    this.db.close();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node manage.js list [--format json|table]
  node manage.js delete <source_id> [--confirm]
  node manage.js reindex [<source_id>]
  node manage.js health-check
  node manage.js stats
  node manage.js cleanup
    `);
    process.exit(1);
  }

  const command = args[0];
  const manager = new KnowledgeBaseManager();

  (async () => {
    try {
      if (command === 'list') {
        const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'table';
        manager.list({ format });
      } else if (command === 'delete') {
        if (args.length < 2) {
          console.log('Source ID required');
          process.exit(1);
        }
        const sourceId = parseInt(args[1]);
        const confirm = args.includes('--confirm');
        const result = manager.delete(sourceId, confirm);
        console.log(result.message);
      } else if (command === 'reindex') {
        const sourceId = args[1] ? parseInt(args[1]) : null;
        const result = await manager.reindex(sourceId);
        console.log(result.message);
      } else if (command === 'health-check') {
        await manager.healthCheck();
      } else if (command === 'stats') {
        manager.stats();
      } else if (command === 'cleanup') {
        const result = manager.cleanup();
        console.log(`\nCleanup complete: deleted ${result.deleted} orphaned sources`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      manager.close();
    }
  })();
}

module.exports = KnowledgeBaseManager;
