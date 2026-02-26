const fetch = require('node-fetch');
const cheerio = require('cheerio');
const config = require('./config.json');

class ContentFetchers {
  static async fetchArticle(url, timeout = config.security.url_timeout_ms) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ReeseAI/1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title
      const title = $('head title').text() || $('h1').first().text() || 'Untitled';

      // Extract meta description
      const description = $('meta[name="description"]').attr('content') || '';

      // Extract main content
      // Try different common content selectors
      let content = '';
      const selectors = [
        'article',
        '[role="main"]',
        '.content',
        '.post-content',
        '.article-body',
        '.entry-content',
        'main'
      ];

      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length) {
          content = element.text();
          break;
        }
      }

      // Fallback to body text
      if (!content) {
        content = $('body').text();
      }

      // Clean up
      content = content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, config.security.max_content_size_mb * 1024 * 1024);

      return {
        title: title.substring(0, 500),
        description: description.substring(0, 1000),
        content: content,
        source_type: 'article',
        author: $('meta[name="author"]').attr('content') || null,
        published_date: $('meta[property="article:published_time"]').attr('content') || null
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Fetch timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  static async fetchYoutube(url) {
    // YouTube transcript fetching
    // This would require youtube-transcript-api or similar
    // For now, return placeholder
    const videoId = this.extractYoutubeId(url);

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    return {
      title: `YouTube Video: ${videoId}`,
      content: '[YouTube transcript would be fetched here]',
      source_type: 'youtube',
      metadata: { video_id: videoId }
    };
  }

  static extractYoutubeId(url) {
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com.*[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  static async fetchPdf(url) {
    // PDF fetching would require pdf-parse or similar
    // For now, return placeholder
    return {
      title: `PDF: ${url.split('/').pop()}`,
      content: '[PDF content would be extracted here]',
      source_type: 'pdf'
    };
  }

  static async fetchTweet(url) {
    // Twitter API would be needed for actual tweets
    // For now, return placeholder
    const tweetId = this.extractTweetId(url);

    if (!tweetId) {
      throw new Error('Invalid Twitter URL');
    }

    return {
      title: `Tweet: ${tweetId}`,
      content: '[Tweet content would be fetched here]',
      source_type: 'tweet',
      metadata: { tweet_id: tweetId }
    };
  }

  static extractTweetId(url) {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  static async fetchLocalFile(filePath) {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const filename = path.basename(filePath);

    // Determine file type
    let sourceType = 'local_markdown';
    if (filePath.endsWith('.pdf')) sourceType = 'local_pdf';
    else if (filePath.endsWith('.md')) sourceType = 'local_markdown';
    else if (filePath.endsWith('.txt')) sourceType = 'local_markdown';

    return {
      title: filename,
      content: content,
      file_path: filePath,
      source_type: sourceType,
      metadata: {
        file_size: stats.size,
        modified_date: stats.mtime.toISOString()
      }
    };
  }

  static async fetch(url, sourceType) {
    if (sourceType === 'article') {
      return this.fetchArticle(url);
    } else if (sourceType === 'youtube') {
      return this.fetchYoutube(url);
    } else if (sourceType === 'pdf') {
      return this.fetchPdf(url);
    } else if (sourceType === 'tweet') {
      return this.fetchTweet(url);
    } else {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }
}

module.exports = ContentFetchers;
