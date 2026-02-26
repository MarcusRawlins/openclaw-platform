const config = require('./config.json');

class EmbeddingsClient {
  constructor() {
    this.url = config.embeddings.url;
    this.model = config.embeddings.model;
    this.dimension = config.embeddings.dimension;
    this.retries = config.ingestion.max_retries;
  }

  async embed(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    // Truncate if too long (safety measure)
    const maxChars = 8000;
    if (text.length > maxChars) {
      text = text.substring(0, maxChars);
    }

    let lastError;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await fetch(`${this.url}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            input: text
          }),
          timeout: 30000
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          throw new Error('Invalid embedding response format');
        }

        const embedding = data.data[0].embedding;

        if (!Array.isArray(embedding) || embedding.length !== this.dimension) {
          throw new Error(
            `Expected embedding of dimension ${this.dimension}, got ${
              Array.isArray(embedding) ? embedding.length : 'unknown'
            }`
          );
        }

        // Convert to Float32Array for efficient storage
        return new Float32Array(embedding);
      } catch (error) {
        lastError = error;
        console.warn(`Embedding attempt ${attempt + 1}/${this.retries} failed:`, error.message);

        if (attempt < this.retries - 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new Error(`Failed to generate embedding after ${this.retries} attempts: ${lastError.message}`);
  }

  // Batch embedding with rate limiting
  async embedBatch(texts, concurrency = 5) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    const embeddings = [];
    const errors = [];

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(text => this.embed(text))
      );

      for (let j = 0; j < batchResults.length; j++) {
        if (batchResults[j].status === 'fulfilled') {
          embeddings.push(batchResults[j].value);
        } else {
          errors.push({
            index: i + j,
            text: batch[j].substring(0, 100),
            error: batchResults[j].reason.message
          });
          embeddings.push(null); // Placeholder
        }
      }
    }

    return {
      embeddings,
      errors,
      failed_count: errors.length,
      success_count: embeddings.filter(e => e !== null).length
    };
  }

  // Verify LM Studio connection
  async healthCheck() {
    try {
      const response = await fetch(`${this.url}/models`, {
        timeout: 5000
      });

      if (!response.ok) {
        return {
          healthy: false,
          error: `HTTP ${response.status}`,
          url: this.url
        };
      }

      const data = await response.json();
      const hasModel = data.data && data.data.some(m => m.id.includes('nomic'));

      return {
        healthy: hasModel,
        url: this.url,
        models_available: data.data ? data.data.length : 0,
        has_nomic_model: hasModel,
        details: {
          models: data.data
            ? data.data.map(m => ({ id: m.id, type: m.object }))
            : []
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        url: this.url
      };
    }
  }

  // Convert Float32Array to Buffer for database storage
  static embeddingToBuffer(embedding) {
    if (embedding instanceof Float32Array) {
      return Buffer.from(embedding.buffer);
    }
    if (Array.isArray(embedding)) {
      return Buffer.from(new Float32Array(embedding).buffer);
    }
    throw new Error('Embedding must be Float32Array or Array');
  }

  // Convert Buffer back to Float32Array for operations
  static bufferToEmbedding(buffer) {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
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
}

module.exports = EmbeddingsClient;
