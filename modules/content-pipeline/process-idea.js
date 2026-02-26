const ContentPipelineDB = require('./db');
const DeduplicationEngine = require('./deduplication');
const KBSearcher = require('./kb-search');
const IdeaSummarizer = require('./summarize');
const TaskCreator = require('./create-task');
const config = require('./config.json');

class IdeaPipeline {
  constructor() {
    this.db = null;
    this.dedup = null;
    this.kbSearcher = null;
    this.summarizer = null;
  }

  async initialize() {
    this.db = new ContentPipelineDB();
    await this.db.initialize();

    this.dedup = new DeduplicationEngine(this.db);
    this.kbSearcher = new KBSearcher();
    await this.kbSearcher.initialize();

    this.summarizer = new IdeaSummarizer();

    return this;
  }

  async processIdea(ideaText, options = {}) {
    console.log(`\n[${'IDEA PIPELINE'}] Processing: "${ideaText}"\n`);

    try {
      // Step 1: Deduplication check
      console.log('[1/6] Checking for duplicates...');
      const dupCheck = await this.dedup.checkDuplicate(ideaText);

      if (dupCheck.isDuplicate) {
        console.log(
          `✗ DUPLICATE (${(dupCheck.score * 100).toFixed(0)}% similar to: "${dupCheck.duplicateTitle}")`
        );

        // Log search
        await this.db.logIdeaSearch(ideaText, 0, 0, true, dupCheck.duplicateId);

        return {
          success: false,
          reason: 'duplicate',
          message: `⚠️ This idea is too similar to existing idea: "${dupCheck.duplicateTitle}" (${(dupCheck.score * 100).toFixed(0)}% match)`,
          duplicateId: dupCheck.duplicateId,
          duplicateScore: dupCheck.score
        };
      }

      console.log('✓ No duplicates found');

      // Step 2: Search knowledge base
      console.log('[2/6] Searching knowledge base...');
      const kbResults = await this.kbSearcher.searchKnowledgeBase(ideaText);

      if (!kbResults.success) {
        console.log(`⚠️ KB search failed: ${kbResults.error}`);
      } else {
        console.log(`✓ Found ${kbResults.result_count} sources (${kbResults.total_chunks} chunks)`);
      }

      const kbSources = kbResults.results || [];

      // Step 3: Social search (placeholder - would require API keys)
      console.log('[3/6] Searching social platforms...');
      const socialSources = {
        youtube: [],
        instagram: [],
        twitter: []
      };
      console.log('⊘ Social search disabled (requires API credentials)');

      // Step 4: Generate summary
      console.log('[4/6] Generating idea summary...');
      const summaryResult = await this.summarizer.generateSummary(ideaText, kbSources, socialSources);

      if (!summaryResult.success) {
        console.log(`⚠️ Summary generation partially failed, using fallback`);
      }

      const summary = summaryResult.summary;
      console.log(`✓ Summary generated: "${summary.title}"`);

      // Step 5: Generate embedding for storage
      console.log('[5/6] Generating embedding...');
      const embedding = dupCheck.embedding;
      if (!embedding) {
        throw new Error('Failed to generate embedding');
      }

      // Step 6: Store in database
      console.log('[6/6] Storing idea in database...');

      const ideaId = await this.db.insertIdea({
        title: summary.title,
        description: summary.description,
        platform: summary.platform,
        content_type: summary.contentType,
        target_audience: summary.targetAudience,
        suggested_outline: summary.suggestedOutline,
        embedding: DeduplicationEngine.embeddingToBuffer(embedding),
        kb_sources: JSON.stringify(kbSources.map((s, i) => ({ index: i, title: s.title }))),
        social_sources: JSON.stringify(socialSources),
        suggested_by: options.suggested_by || 'Marcus'
      });

      console.log(`✓ Idea stored with ID: ${ideaId}`);

      // Create Mission Control task
      const taskResult = await TaskCreator.createMissionControlTask({
        id: ideaId,
        summary,
        kbSources,
        socialSources
      });

      if (taskResult.success) {
        // Update idea with task ID
        await this.db.updateIdea(ideaId, {
          task_id: taskResult.taskId
        });
      }

      // Log search
      await this.db.logIdeaSearch(ideaText, kbResults.result_count, 0, false, null);

      console.log('\n✅ Idea Processing Complete\n');

      return {
        success: true,
        ideaId,
        taskId: taskResult.taskId,
        summary,
        message: this._formatReply(summary, kbSources, socialSources, taskResult.taskId)
      };
    } catch (error) {
      console.error(`\n✗ Pipeline Error: ${error.message}\n`);

      return {
        success: false,
        error: error.message,
        message: `❌ Failed to process idea: ${error.message}`
      };
    }
  }

  _formatReply(summary, kbSources, socialSources, taskId) {
    return `✅ **Content Idea Captured**

**${summary.title}**

${summary.description}

**Platform:** ${summary.platform.toUpperCase()}
**Format:** ${summary.contentType}
**Target:** ${summary.targetAudience}

**Suggested Outline:**
${summary.suggestedOutline}

**Research Sources:**
- Knowledge Base: ${kbSources.length} sources
- YouTube: ${(socialSources.youtube || []).length} videos
- Instagram: ${(socialSources.instagram || []).length} posts
- Twitter: ${(socialSources.twitter || []).length} discussions

**Next Steps:**
Task created in Mission Control (ID: ${taskId})
Assigned to Ada for content creation

Reply "accept idea ${taskId}" to greenlight or "reject idea ${taskId}" to discard.`;
  }

  async close() {
    if (this.db) await this.db.close();
    if (this.kbSearcher) await this.kbSearcher.close();
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node process-idea.js "your idea text here" [--suggested-by <name>]

Example:
  node process-idea.js "wedding photography pricing guide" --suggested-by Tyler
    `);
    process.exit(1);
  }

  const ideaText = args[0];
  let suggestedBy = 'Marcus';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--suggested-by' && i + 1 < args.length) {
      suggestedBy = args[++i];
    }
  }

  (async () => {
    const pipeline = await new IdeaPipeline().initialize();
    try {
      const result = await pipeline.processIdea(ideaText, { suggested_by: suggestedBy });
      console.log(result.message);

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      await pipeline.close();
    }
  })();
}

module.exports = IdeaPipeline;
