const fs = require('fs');
const path = require('path');

const ENV_FILE = '/Users/marcusrawlins/.openclaw/.env';

// Load .env file once
let envCache = null;
function loadEnv() {
  if (envCache) return envCache;
  envCache = {};
  
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (match) {
        envCache[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
  
  // Also check process.env (overrides file)
  return envCache;
}

const PROVIDER_CREDENTIALS = {
  anthropic: {
    resolve: () => ({
      apiKey: process.env.ANTHROPIC_API_KEY || loadEnv().ANTHROPIC_API_KEY
    }),
    required: ['apiKey'],
    envVars: ['ANTHROPIC_API_KEY']
  },
  openai: {
    resolve: () => ({
      apiKey: process.env.OPENAI_API_KEY || loadEnv().OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com'
    }),
    required: ['apiKey'],
    envVars: ['OPENAI_API_KEY']
  },
  google: {
    resolve: () => ({
      apiKey: process.env.GOOGLE_AI_API_KEY || loadEnv().GOOGLE_AI_API_KEY
    }),
    required: ['apiKey'],
    envVars: ['GOOGLE_AI_API_KEY']
  },
  lmstudio: {
    resolve: () => ({
      baseUrl: process.env.LM_STUDIO_URL || loadEnv().LM_STUDIO_URL || 'http://127.0.0.1:1234'
    }),
    required: ['baseUrl'],
    envVars: ['LM_STUDIO_URL']
  }
};

function resolveCredentials(provider) {
  const config = PROVIDER_CREDENTIALS[provider];
  if (!config) {
    throw new Error(`No credential config for provider: ${provider}`);
  }
  
  const creds = config.resolve();
  
  // Validate required fields
  for (const field of config.required) {
    if (!creds[field]) {
      throw new Error(
        `Missing credential '${field}' for ${provider}. Set one of: ${config.envVars.join(', ')}`
      );
    }
  }
  
  return creds;
}

module.exports = { resolveCredentials, PROVIDER_CREDENTIALS };
