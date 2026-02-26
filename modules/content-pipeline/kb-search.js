const QueryEngine = require('../knowledge-base-rag/query');
const config = require('./config.json');

class KBSearcher {
  constructor() {
    this.queryEngine = null;
  }

  async initialize() {
    this.queryEngine = new QueryEngine();
    return this;
  }

  // Search knowledge base for idea context
  async searchKnowledgeBase(ideaText) {
    try {
      if (!this.queryEngine) {
        await this.initialize();
      }

      // Search using hybrid method (vector + keyword)
      const results = await this.queryEngine.searchHybrid(ideaText, {
        limit: config.knowledge_base.search_limit,
        source_type: null
      });

      // Group results by source
      const sources = {};

      for (const result of results) {
        const sourceId = result.source?.title || result.id;

        if (!sources[sourceId]) {
          sources[sourceId] = {
            id: result.source?.file_path || result.source?.url || sourceId,
            title: result.source?.title || sourceId,
            type: result.source?.type || 'unknown',
            url: result.source?.url,
            file_path: result.source?.file_path,
            chunks: []
          };
        }

        sources[sourceId].chunks.push({
          text: result.full_text || result.text,
          preview: (result.text || '').substring(0, 200) + '...',
          similarity: result.similarity || 0,
          search_type: result.search_type
        });
      }

      const formattedResults = Object.values(sources).map(source => ({
        title: source.title,
        type: source.type,
        url: source.url,
        file_path: source.file_path,
        relevance_count: source.chunks.length,
        chunks: source.chunks
      }));

      return {
        success: true,
        query: ideaText,
        results: formattedResults,
        result_count: formattedResults.length,
        total_chunks: results.length
      };
    } catch (error) {
      console.error('KB search failed:', error.message);
      return {
        success: false,
        query: ideaText,
        error: error.message,
        results: [],
        result_count: 0
      };
    }
  }

  // Get specific source details
  async getSourceDetails(sourceId) {
    try {
      if (!this.queryEngine) {
        await this.initialize();
      }

      const details = this.queryEngine.getSourceDetails(sourceId);
      return {
        success: !!details,
        source: details
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search by source type
  async searchByType(sourceType) {
    try {
      if (!this.queryEngine) {
        await this.initialize();
      }

      const results = this.queryEngine.searchByType(sourceType);
      return {
        success: true,
        type: sourceType,
        results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get KB stats
  async getStats() {
    try {
      if (!this.queryEngine) {
        await this.initialize();
      }

      const stats = this.queryEngine.getStats();
      return {
        success: true,
        stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async close() {
    if (this.queryEngine) {
      this.queryEngine.close();
    }
  }
}

module.exports = KBSearcher;
