const config = require('./config.json');

class TextChunker {
  constructor() {
    this.chunk_size = config.chunking.chunk_size;
    this.chunk_overlap = config.chunking.chunk_overlap;
    this.max_chunk_size = config.chunking.max_chunk_size;
  }

  // Simple token counter (approximate by splitting on whitespace)
  countTokens(text) {
    return text.trim().split(/\s+/).length;
  }

  // Split text into sentences for better chunking
  splitIntoSentences(text) {
    // Simple sentence splitting on . ! ? followed by space and capital letter
    return text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  }

  // Chunk text with overlap
  chunk(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const chunkSize = options.chunk_size || this.chunk_size;
    const chunkOverlap = options.chunk_overlap || this.chunk_overlap;
    const maxChunkSize = options.max_chunk_size || this.max_chunk_size;

    // Remove excess whitespace
    text = text.trim().replace(/\n\s*\n/g, '\n\n');

    // Split into sentences
    const sentences = this.splitIntoSentences(text);

    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);

      // If adding this sentence would exceed chunk size, save the current chunk
      if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          token_count: currentTokens
        });

        // Create overlap by keeping some of the previous content
        const overlapTokens = Math.min(chunkOverlap, currentTokens);
        const overlapWords = Math.ceil((overlapTokens / currentTokens) * currentChunk.split(/\s+/).length);
        currentChunk = currentChunk
          .split(/\s+/)
          .slice(-overlapWords)
          .join(' ');
        currentTokens = this.countTokens(currentChunk);
      }

      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens = this.countTokens(currentChunk);

      // Safeguard against extremely long chunks
      if (currentTokens > maxChunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          token_count: currentTokens
        });
        currentChunk = '';
        currentTokens = 0;
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        token_count: this.countTokens(currentChunk)
      });
    }

    return chunks;
  }

  // Smart chunking by markdown headers (for documents with structure)
  chunkByStructure(text, options = {}) {
    const chunks = [];
    const lines = text.split('\n');

    let currentSection = '';
    let sectionTitle = '';

    for (const line of lines) {
      // Check for headers (# ## ### etc)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // If we have accumulated content, chunk it
        if (currentSection.trim().length > 0) {
          const sectionChunks = this.chunk(currentSection, options);
          sectionChunks.forEach((chunk, index) => {
            chunks.push({
              text: `${sectionTitle ? `From section: ${sectionTitle}\n\n` : ''}${chunk.text}`,
              token_count: chunk.token_count,
              section_title: sectionTitle
            });
          });
        }

        sectionTitle = headerMatch[2];
        currentSection = '';
      } else {
        currentSection += (currentSection ? '\n' : '') + line;
      }
    }

    // Handle final section
    if (currentSection.trim().length > 0) {
      const sectionChunks = this.chunk(currentSection, options);
      sectionChunks.forEach((chunk, index) => {
        chunks.push({
          text: `${sectionTitle ? `From section: ${sectionTitle}\n\n` : ''}${chunk.text}`,
          token_count: chunk.token_count,
          section_title: sectionTitle
        });
      });
    }

    return chunks;
  }

  // Chunk with prefix/context (useful for summarization or RAG)
  chunkWithContext(text, contextLength = 100, options = {}) {
    const chunks = this.chunk(text, options);

    return chunks.map((chunk, index) => {
      let context = '';

      // Add context from previous chunk if available
      if (index > 0) {
        const prevText = chunks[index - 1].text;
        const words = prevText.split(/\s+/);
        context = words.slice(-Math.ceil(contextLength / 10)).join(' ');
      }

      return {
        ...chunk,
        context,
        position: index,
        total_chunks: chunks.length
      };
    });
  }

  // Test: validate chunk sizes
  validateChunks(chunks) {
    const validation = {
      valid: true,
      issues: [],
      stats: {
        total_chunks: chunks.length,
        avg_tokens: 0,
        min_tokens: Infinity,
        max_tokens: 0,
        total_tokens: 0
      }
    };

    chunks.forEach((chunk, index) => {
      const tokenCount = chunk.token_count || this.countTokens(chunk.text);

      if (tokenCount > this.max_chunk_size) {
        validation.valid = false;
        validation.issues.push(`Chunk ${index} exceeds max size: ${tokenCount} tokens`);
      }

      if (tokenCount === 0) {
        validation.issues.push(`Chunk ${index} is empty`);
      }

      validation.stats.total_tokens += tokenCount;
      validation.stats.min_tokens = Math.min(validation.stats.min_tokens, tokenCount);
      validation.stats.max_tokens = Math.max(validation.stats.max_tokens, tokenCount);
    });

    validation.stats.avg_tokens = Math.round(
      validation.stats.total_tokens / chunks.length
    );

    if (validation.stats.min_tokens === Infinity) {
      validation.stats.min_tokens = 0;
    }

    return validation;
  }
}

module.exports = TextChunker;
