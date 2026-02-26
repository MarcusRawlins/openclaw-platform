const config = require('./config.json');
const URL = require('url').URL;

class SecurityValidator {
  constructor() {
    this.allowed_schemes = config.security.allowed_schemes;
    this.timeout_ms = config.security.url_timeout_ms;
    this.max_content_size = config.security.max_content_size_mb * 1024 * 1024;
  }

  // Validate URL format and scheme
  validateUrl(urlString) {
    try {
      const url = new URL(urlString);

      // Check scheme
      if (!this.allowed_schemes.includes(url.protocol.replace(':', ''))) {
        return {
          valid: false,
          error: `Invalid URL scheme: ${url.protocol}. Allowed: ${this.allowed_schemes.join(', ')}`
        };
      }

      // Check for suspicious patterns in hostname
      const hostSuspicious = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '192.168.',
        '10.0.',
        '172.16.'
      ];

      for (const pattern of hostSuspicious) {
        if (url.hostname.includes(pattern)) {
          return {
            valid: false,
            error: `URL points to private/local network: ${url.hostname}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Invalid URL format: ${error.message}` };
    }
  }

  // Validate source type
  validateSourceType(sourceType) {
    const validTypes = ['article', 'youtube', 'pdf', 'tweet', 'local_pdf', 'local_video', 'local_markdown'];
    return validTypes.includes(sourceType);
  }

  // Sanitize HTML content to prevent injection
  sanitizeContent(content) {
    if (typeof content !== 'string') {
      return '';
    }

    // Remove script tags and event handlers
    let sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove suspicious HTML entities
    sanitized = sanitized
      .replace(/&#x?[0-9a-fA-F]+;/g, '') // Hex entities
      .replace(/&[a-z]+;/g, match => {
        // Only allow common safe entities
        const safeEntities = ['&lt;', '&gt;', '&amp;', '&quot;', '&apos;', '&nbsp;'];
        return safeEntities.includes(match) ? match : '';
      });

    return sanitized;
  }

  // Detect common injection patterns
  detectInjection(text) {
    if (typeof text !== 'string') {
      return { suspicious: false };
    }

    const injectionPatterns = [
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /<iframe/gi,
      /<frame/gi,
      /document\.location/gi,
      /window\.location/gi,
      /eval\(/gi,
      /expression\(/gi
    ];

    const found = [];
    for (const pattern of injectionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        found.push(...matches);
      }
    }

    return {
      suspicious: found.length > 0,
      patterns_found: found.length,
      examples: found.slice(0, 5)
    };
  }

  // Validate content size
  validateContentSize(content) {
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    return {
      valid: sizeBytes <= this.max_content_size,
      size_bytes: sizeBytes,
      size_mb: (sizeBytes / 1024 / 1024).toFixed(2),
      max_allowed_mb: config.security.max_content_size_mb
    };
  }

  // Validate chunk count
  validateChunkCount(chunks) {
    const maxChunks = config.security.max_chunks_per_source;
    return {
      valid: chunks.length <= maxChunks,
      chunk_count: chunks.length,
      max_allowed: maxChunks
    };
  }

  // Comprehensive validation for a source
  validateSource(sourceData) {
    const issues = [];

    // Validate URL if present
    if (sourceData.url) {
      const urlValidation = this.validateUrl(sourceData.url);
      if (!urlValidation.valid) {
        issues.push(`URL: ${urlValidation.error}`);
      }
    }

    // Validate source type
    if (!this.validateSourceType(sourceData.source_type)) {
      issues.push(
        `Invalid source_type: ${sourceData.source_type}. Must be one of: article, youtube, pdf, tweet, local_pdf, local_video, local_markdown`
      );
    }

    // Validate title
    if (sourceData.title && typeof sourceData.title !== 'string') {
      issues.push('Title must be a string');
    }

    // Validate tags
    if (sourceData.tags && !Array.isArray(sourceData.tags)) {
      issues.push('Tags must be an array');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // Comprehensive validation for content before ingestion
  validateIngestion(content, chunks) {
    const validation = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Check injection
    const injectionCheck = this.detectInjection(content);
    if (injectionCheck.suspicious) {
      validation.errors.push(
        `Potential injection detected: ${injectionCheck.patterns_found} suspicious patterns`
      );
      validation.valid = false;
    }

    // Check content size
    const sizeCheck = this.validateContentSize(content);
    if (!sizeCheck.valid) {
      validation.errors.push(
        `Content too large: ${sizeCheck.size_mb}MB (max: ${sizeCheck.max_allowed_mb}MB)`
      );
      validation.valid = false;
    }

    // Check chunk count
    const chunkCheck = this.validateChunkCount(chunks);
    if (!chunkCheck.valid) {
      validation.errors.push(
        `Too many chunks: ${chunkCheck.chunk_count} (max: ${chunkCheck.max_allowed})`
      );
      validation.valid = false;
    }

    // Warn if mostly empty
    const nonEmptyChunks = chunks.filter(c => c.text.trim().length > 10).length;
    if (nonEmptyChunks === 0) {
      validation.errors.push('No meaningful content extracted');
      validation.valid = false;
    } else if (nonEmptyChunks < chunks.length * 0.5) {
      validation.warnings.push(
        `Only ${nonEmptyChunks}/${chunks.length} chunks have meaningful content`
      );
    }

    return validation;
  }
}

module.exports = SecurityValidator;
