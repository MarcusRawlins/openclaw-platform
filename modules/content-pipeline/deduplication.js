const EmbeddingsClient = require('../knowledge-base-rag/embeddings');
const config = require('./config.json');

const SIMILARITY_THRESHOLD = config.deduplication.similarity_threshold;

class DeduplicationEngine {
  constructor(db) {
    this.db = db;
    this.embeddings = new EmbeddingsClient();
  }

  // Calculate cosine similarity between two embeddings
  static cosineSimilarity(embedding1, embedding2) {
    if (!(embedding1 instanceof Float32Array) || !(embedding2 instanceof Float32Array)) {
      throw new Error('Both embeddings must be Float32Array');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  // Convert Float32Array to Buffer for storage
  static embeddingToBuffer(embedding) {
    if (embedding instanceof Float32Array) {
      return Buffer.from(embedding.buffer);
    }
    if (Array.isArray(embedding)) {
      return Buffer.from(new Float32Array(embedding).buffer);
    }
    throw new Error('Embedding must be Float32Array or Array');
  }

  // Convert Buffer back to Float32Array
  static bufferToEmbedding(buffer) {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
  }

  // Check if idea is a duplicate
  async checkDuplicate(ideaText) {
    if (!config.deduplication.enabled) {
      return { isDuplicate: false, score: 0 };
    }

    try {
      // Generate embedding for new idea
      const newEmbedding = await this.embeddings.embed(ideaText);

      // Get all existing ideas that are not rejected/duplicate
      const existingIdeas = await this.db.findSimilarIdeas(100);

      // Compare with each existing idea
      for (const idea of existingIdeas) {
        if (!idea.embedding) continue;

        const existingEmbedding = DeduplicationEngine.bufferToEmbedding(idea.embedding);
        const similarity = DeduplicationEngine.cosineSimilarity(newEmbedding, existingEmbedding);

        if (similarity > SIMILARITY_THRESHOLD) {
          return {
            isDuplicate: true,
            score: similarity,
            duplicateId: idea.id,
            duplicateTitle: idea.title,
            duplicateStatus: idea.status
          };
        }
      }

      // No duplicate found, store the embedding for future checks
      return {
        isDuplicate: false,
        score: 0,
        embedding: newEmbedding
      };
    } catch (error) {
      console.error('Deduplication check failed:', error.message);
      // On error, proceed without deduplication
      return { isDuplicate: false, score: 0, error: error.message };
    }
  }

  // Find similar ideas (not necessarily duplicates)
  async findSimilar(ideaText, limit = 5, threshold = 0.25) {
    try {
      const newEmbedding = await this.embeddings.embed(ideaText);
      const existingIdeas = await this.db.findSimilarIdeas(50);

      const similarities = existingIdeas
        .filter(idea => idea.embedding)
        .map(idea => {
          const existingEmbedding = DeduplicationEngine.bufferToEmbedding(idea.embedding);
          const similarity = DeduplicationEngine.cosineSimilarity(newEmbedding, existingEmbedding);

          return {
            id: idea.id,
            title: idea.title,
            status: idea.status,
            similarity,
            suggested_at: idea.suggested_at
          };
        })
        .filter(result => result.similarity > threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return similarities;
    } catch (error) {
      console.error('Similar ideas search failed:', error.message);
      return [];
    }
  }

  // Get deduplication statistics
  async getStats() {
    const stats = await this.db.getStats();

    return {
      total_ideas: stats.total_ideas,
      duplicates_detected: stats.duplicates_detected,
      duplicate_rate:
        stats.total_ideas > 0 ? ((stats.duplicates_detected / stats.total_ideas) * 100).toFixed(1) : '0',
      threshold: (SIMILARITY_THRESHOLD * 100).toFixed(0) + '%',
      enabled: config.deduplication.enabled
    };
  }

  async close() {
    // Embeddings client doesn't need explicit closing
  }
}

module.exports = DeduplicationEngine;
