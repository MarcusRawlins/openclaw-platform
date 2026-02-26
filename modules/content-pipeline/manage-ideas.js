const ContentPipelineDB = require('./db');
const TaskCreator = require('./create-task');

class IdeaManager {
  constructor() {
    this.db = null;
  }

  async initialize() {
    this.db = new ContentPipelineDB();
    await this.db.initialize();
    return this;
  }

  // List ideas
  async listIdeas(status = null, limit = 50) {
    const ideas = await this.db.getAllIdeas(status, limit);

    console.log('\n=== Content Ideas ===\n');

    if (ideas.length === 0) {
      console.log(status ? `No ideas with status: ${status}` : 'No ideas found');
      return ideas;
    }

    for (const idea of ideas) {
      console.log(`[${idea.id}] ${idea.title}`);
      console.log(`    Status: ${idea.status}`);
      if (idea.platform) console.log(`    Platform: ${idea.platform}`);
      if (idea.content_type) console.log(`    Format: ${idea.content_type}`);
      console.log(`    Created: ${new Date(idea.suggested_at).toLocaleDateString()}`);
      if (idea.task_id) console.log(`    Task: ${idea.task_id}`);
      console.log();
    }

    return ideas;
  }

  // Get idea details
  async getIdeaDetails(ideaId) {
    const idea = await this.db.getIdea(ideaId);

    if (!idea) {
      console.log(`Idea ${ideaId} not found`);
      return null;
    }

    console.log('\n=== Idea Details ===\n');
    console.log(`Title: ${idea.title}`);
    console.log(`ID: ${idea.id}`);
    console.log(`Status: ${idea.status}`);
    console.log(`Created: ${new Date(idea.suggested_at).toLocaleString()}`);
    console.log(`Suggested by: ${idea.suggested_by}`);

    if (idea.description) console.log(`\nDescription:\n${idea.description}`);
    if (idea.platform) console.log(`\nPlatform: ${idea.platform}`);
    if (idea.content_type) console.log(`Format: ${idea.content_type}`);
    if (idea.target_audience) console.log(`Target: ${idea.target_audience}`);

    if (idea.suggested_outline) {
      console.log(`\nOutline:\n${idea.suggested_outline}`);
    }

    if (idea.task_id) {
      console.log(`\nMission Control Task: ${idea.task_id}`);
    }

    if (idea.duplicate_of) {
      console.log(`\nMarked as duplicate of idea ${idea.duplicate_of}`);
      console.log(`Similarity: ${(idea.similarity_score * 100).toFixed(1)}%`);
    }

    console.log();

    return idea;
  }

  // Accept idea
  async acceptIdea(ideaId) {
    const idea = await this.db.getIdea(ideaId);

    if (!idea) {
      console.log(`Idea ${ideaId} not found`);
      return false;
    }

    await this.db.acceptIdea(ideaId);

    // Update task status if exists
    if (idea.task_id) {
      await TaskCreator.updateTaskStatus(idea.task_id, 'active');
    }

    console.log(`✓ Idea ${ideaId} accepted`);
    console.log(`Task status updated to active: ${idea.task_id}`);

    return true;
  }

  // Reject idea
  async rejectIdea(ideaId) {
    const idea = await this.db.getIdea(ideaId);

    if (!idea) {
      console.log(`Idea ${ideaId} not found`);
      return false;
    }

    await this.db.rejectIdea(ideaId);

    // Delete task if exists
    if (idea.task_id) {
      await TaskCreator.deleteTask(idea.task_id);
    }

    console.log(`✓ Idea ${ideaId} rejected`);
    if (idea.task_id) {
      console.log(`Task deleted: ${idea.task_id}`);
    }

    return true;
  }

  // Statistics
  async showStats() {
    const stats = await this.db.getStats();

    console.log('\n=== Content Idea Statistics ===\n');
    console.log(`Total Ideas: ${stats.total_ideas}`);

    if (stats.by_status) {
      console.log(`\nBy Status:`);
      for (const [status, count] of Object.entries(stats.by_status)) {
        console.log(`  ${status}: ${count}`);
      }
    }

    console.log(`\nTotal Searches: ${stats.total_searches}`);
    console.log(`Duplicates Detected: ${stats.duplicates_detected}`);

    if (stats.total_ideas > 0) {
      console.log(`Duplicate Rate: ${((stats.duplicates_detected / stats.total_ideas) * 100).toFixed(1)}%`);
    }

    console.log();

    return stats;
  }

  // Show search history
  async showSearchHistory(limit = 20) {
    const searches = await this.db.getSearchHistory(limit);

    console.log('\n=== Idea Search History ===\n');

    if (searches.length === 0) {
      console.log('No searches');
      return;
    }

    for (const search of searches) {
      const date = new Date(search.searched_at).toLocaleString();
      const query = search.query.substring(0, 50);
      const status = search.duplicate_found ? '⚠️ DUPLICATE' : '✓ UNIQUE';

      console.log(`${date} | ${status} | "${query}"`);
      console.log(`  KB: ${search.kb_results} | Social: ${search.social_results}`);
    }

    console.log();
  }

  async close() {
    if (this.db) await this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node manage-ideas.js list [<status>]
  node manage-ideas.js detail <idea_id>
  node manage-ideas.js accept <idea_id>
  node manage-ideas.js reject <idea_id>
  node manage-ideas.js stats
  node manage-ideas.js history [<limit>]

Status values: proposed, accepted, rejected, in_progress, produced, duplicate

Examples:
  node manage-ideas.js list                    # All ideas
  node manage-ideas.js list proposed           # Only proposed ideas
  node manage-ideas.js detail 5                # Show idea #5 details
  node manage-ideas.js accept 5                # Accept idea #5
  node manage-ideas.js stats                   # Show statistics
    `);
    process.exit(1);
  }

  (async () => {
    const manager = await new IdeaManager().initialize();
    try {
      const command = args[0];
      const arg1 = args[1];

      if (command === 'list') {
        await manager.listIdeas(arg1);
      } else if (command === 'detail') {
        if (!arg1) {
          console.log('Idea ID required');
          process.exit(1);
        }
        await manager.getIdeaDetails(parseInt(arg1));
      } else if (command === 'accept') {
        if (!arg1) {
          console.log('Idea ID required');
          process.exit(1);
        }
        await manager.acceptIdea(parseInt(arg1));
      } else if (command === 'reject') {
        if (!arg1) {
          console.log('Idea ID required');
          process.exit(1);
        }
        await manager.rejectIdea(parseInt(arg1));
      } else if (command === 'stats') {
        await manager.showStats();
      } else if (command === 'history') {
        const limit = arg1 ? parseInt(arg1) : 20;
        await manager.showSearchHistory(limit);
      } else {
        console.log(`Unknown command: ${command}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      await manager.close();
    }
  })();
}

module.exports = IdeaManager;
