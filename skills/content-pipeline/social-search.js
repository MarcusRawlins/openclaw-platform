const config = require('./config.json');
const fetch = require('node-fetch');

// Helper to fetch and parse URLs
async function fetchURL(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    return null;
  }
}

// Simple HTML text extraction
function stripHTML(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

class SocialSearcher {
  // YouTube search - fetch and parse search results
  static async searchYouTube(query) {
    try {
      // Build YouTube search URL
      const searchURL = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const html = await fetchURL(searchURL);
      
      if (!html) return [];

      const results = [];
      // Extract video titles and URLs from HTML (simple pattern matching)
      const videoPattern = /"videoId":"([^"]+)","title":{"simpleText":"([^"]+)"/g;
      let match;
      let count = 0;
      
      while ((match = videoPattern.exec(html)) && count < 5) {
        results.push({
          platform: 'youtube',
          title: match[2],
          url: `https://www.youtube.com/watch?v=${match[1]}`,
          videoId: match[1],
          type: 'video'
        });
        count++;
      }

      return results;
    } catch (err) {
      console.error('YouTube search error:', err.message);
      return [];
    }
  }

  // Instagram search using web search API approach
  static async searchInstagram(query) {
    try {
      // Search for Instagram posts mentioning the topic
      const results = [];
      // This would use web_search tool to find Instagram posts about the topic
      // For now, return empty as we can't directly query Instagram without API
      // Future: use external Instagram scraping service or API
      return results;
    } catch (err) {
      console.error('Instagram search error:', err.message);
      return [];
    }
  }

  // Twitter/X search using web search
  static async searchTwitter(query) {
    try {
      // Search Twitter via web search engine
      // Example: site:twitter.com "photography" tips
      const searchQuery = `site:twitter.com "${query.substring(0, 20)}"`;
      
      // This would use web_search tool to find tweets
      // For now, return empty - would need integration with web_search tool
      return [];
    } catch (err) {
      console.error('Twitter search error:', err.message);
      return [];
    }
  }

  // TikTok search (placeholder)
  static async searchTikTok(query) {
    // TikTok API is restricted, would likely need unofficial API
    // Returns: video URL, creator, views, likes, comments

    console.log('TikTok search: not yet implemented');
    return [];
  }

  // Search all enabled platforms
  static async searchAllPlatforms(query) {
    const results = {
      youtube: [],
      instagram: [],
      twitter: [],
      tiktok: []
    };

    if (config.social_search.youtube_enabled) {
      results.youtube = await this.searchYouTube(query);
    }

    if (config.social_search.instagram_enabled) {
      results.instagram = await this.searchInstagram(query);
    }

    if (config.social_search.twitter_enabled) {
      results.twitter = await this.searchTwitter(query);
    }

    // TikTok disabled for now
    // results.tiktok = await this.searchTikTok(query);

    return results;
  }

  // Get search status
  static getStatus() {
    return {
      youtube: {
        enabled: config.social_search.youtube_enabled,
        requires: 'YOUTUBE_API_KEY in .env'
      },
      instagram: {
        enabled: config.social_search.instagram_enabled,
        requires: 'Instagram Graph API credentials'
      },
      twitter: {
        enabled: config.social_search.twitter_enabled,
        requires: 'TWITTER_BEARER_TOKEN in .env'
      },
      tiktok: {
        enabled: false,
        requires: 'TikTok API (restricted)'
      }
    };
  }
}

module.exports = SocialSearcher;
