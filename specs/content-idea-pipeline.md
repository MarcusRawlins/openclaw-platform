# Content Idea Pipeline & Deduplication System

**Priority:** High
**Estimated Time:** 2-3 days
**Dependencies:** AnselAI Phase 1 (database), Knowledge Base RAG (embeddings)

## Goal

Build an automated content idea pipeline triggered by keyword phrase in Telegram. Search knowledge base + social platforms for context, check for duplicate ideas, create project card in Mission Control, track idea lifecycle.

## Architecture

```
Telegram Message: "content idea: wedding photography pricing"
         ↓
    Trigger Detection (Marcus watches for keyword)
         ↓
    ┌────────────────────────────────────────────┐
    │     Content Idea Pipeline                   │
    ├────────────────────────────────────────────┤
    │  1. Search Knowledge Base (RAG)            │
    │     → Related articles, videos, PDFs        │
    │                                             │
    │  2. Search Social Platforms                │
    │     → YouTube: related videos              │
    │     → Instagram: trending posts            │
    │     → X/Twitter: recent discourse          │
    │                                             │
    │  3. Deduplication Check                    │
    │     → Embed idea text                      │
    │     → Search existing ideas DB             │
    │     → If similarity >40% → REJECT          │
    │                                             │
    │  4. Create Idea Record                     │
    │     → Store in ideas DB                    │
    │     → Status: proposed                     │
    │                                             │
    │  5. Generate Summary Card                  │
    │     → Title, description                   │
    │     → Sources (KB + social)                │
    │     → Suggested outline                    │
    │     → Metrics (if similar content exists)  │
    │                                             │
    │  6. Create MC Task Card                    │
    │     → Add to Mission Control backlog       │
    │     → Assign to Ada                        │
    │                                             │
    │  7. Reply in Thread                        │
    │     → "✓ Idea captured: [title]"          │
    │     → "Similar existing: [links]"          │
    │     → "Suggested outline: [preview]"       │
    └────────────────────────────────────────────┘
```

## Database Schema

**File:** AnselAI database (PostgreSQL), add new tables:

```sql
-- Content ideas
CREATE TABLE content_ideas (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  suggested_by VARCHAR(100), -- Tyler, Marcus, etc.
  suggested_at TIMESTAMP DEFAULT NOW(),
  
  -- Lifecycle
  status VARCHAR(50) DEFAULT 'proposed', -- proposed, accepted, rejected, in_progress, produced, duplicate
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  produced_at TIMESTAMP,
  
  -- Content details
  platform VARCHAR(50), -- instagram, tiktok, youtube, blog
  content_type VARCHAR(50), -- reel, post, video, article
  target_audience TEXT,
  suggested_outline TEXT,
  
  -- Metadata
  embedding VECTOR(768), -- For deduplication via similarity search
  duplicate_of INTEGER REFERENCES content_ideas(id), -- If rejected as duplicate
  similarity_score DECIMAL(5,4), -- Score when marked as duplicate
  
  -- Sources
  kb_sources TEXT, -- JSON array of KB source IDs
  social_sources TEXT, -- JSON array of social post URLs
  
  -- Tracking
  task_id VARCHAR(100), -- Mission Control task ID (if created)
  content_id INTEGER, -- Final content ID (if produced)
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Idea search history (for analytics)
CREATE TABLE idea_searches (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  kb_results INTEGER DEFAULT 0,
  social_results INTEGER DEFAULT 0,
  duplicate_found BOOLEAN DEFAULT FALSE,
  duplicate_id INTEGER REFERENCES content_ideas(id),
  searched_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ideas_status ON content_ideas(status);
CREATE INDEX idx_ideas_platform ON content_ideas(platform);
CREATE INDEX idx_ideas_suggested_at ON content_ideas(suggested_at);

-- Vector index for similarity search
CREATE INDEX idx_ideas_embedding ON content_ideas USING ivfflat (embedding vector_cosine_ops);
```

## Phase 1: Trigger Detection (Marcus Integration)

**File:** `/agents/main/content-idea-detector.js`

Marcus watches Telegram for keyword phrase: `"content idea"` or `"idea:"`

```javascript
// In Marcus's message handler
function detectContentIdea(message) {
  const triggers = ['content idea:', 'idea:'];
  
  for (const trigger of triggers) {
    if (message.toLowerCase().includes(trigger)) {
      const ideaText = message.substring(message.toLowerCase().indexOf(trigger) + trigger.length).trim();
      return ideaText;
    }
  }
  
  return null;
}

// When detected:
async function handleContentIdea(ideaText, messageId) {
  // Spawn content idea pipeline
  const result = await exec({
    command: `node /workspace/skills/content-pipeline/process-idea.js "${ideaText}" --message-id=${messageId}`
  });
  
  // Reply in thread with result
  await message({
    action: 'send',
    replyTo: messageId,
    message: result.summary
  });
}
```

## Phase 2: Knowledge Base Search

**File:** `skills/content-pipeline/kb-search.js`

```javascript
const { search } = require('../knowledge-base-rag/query');

async function searchKnowledgeBase(ideaText) {
  // Semantic search across KB
  const results = await search(ideaText, {
    limit: 10,
    threshold: 0.6
  });
  
  // Group by source
  const sources = {};
  for (const result of results) {
    if (!sources[result.source.id]) {
      sources[result.source.id] = {
        title: result.source.title,
        type: result.source.type,
        url: result.source.url,
        chunks: []
      };
    }
    sources[result.source.id].chunks.push({
      text: result.text,
      similarity: result.similarity
    });
  }
  
  return Object.values(sources);
}
```

## Phase 3: Social Platform Search

**File:** `skills/content-pipeline/social-search.js`

```javascript
// YouTube search
async function searchYouTube(query) {
  // Use YouTube Data API or youtube-search-api
  // Search for recent videos on topic
  // Return: title, channel, views, url
}

// Instagram search
async function searchInstagram(query) {
  // Use Instagram Graph API (from AnselAI)
  // Search hashtags related to topic
  // Return top posts
}

// X/Twitter search
async function searchTwitter(query) {
  // Use Twitter API v2 or web scraping
  // Search recent tweets/threads
  // Return top posts
}

async function searchAllPlatforms(ideaText) {
  const [youtube, instagram, twitter] = await Promise.all([
    searchYouTube(ideaText),
    searchInstagram(ideaText),
    searchTwitter(ideaText)
  ]);
  
  return { youtube, instagram, twitter };
}
```

## Phase 4: Deduplication Check

**File:** `skills/content-pipeline/deduplication.js`

```javascript
const { generateEmbedding } = require('../knowledge-base-rag/embeddings');
const db = require('./db'); // AnselAI database

const SIMILARITY_THRESHOLD = 0.40; // 40% similarity = duplicate

async function checkDuplicate(ideaText) {
  // 1. Generate embedding for new idea
  const embedding = await generateEmbedding(ideaText);
  
  // 2. Search existing ideas using vector similarity
  const existing = await db.query(`
    SELECT 
      id, 
      title, 
      description,
      status,
      1 - (embedding <=> $1) AS similarity
    FROM content_ideas
    WHERE status NOT IN ('rejected', 'duplicate')
    ORDER BY embedding <=> $1
    LIMIT 10
  `, [embedding]);
  
  // 3. Check threshold
  for (const idea of existing) {
    if (idea.similarity > SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        duplicateOf: idea.id,
        duplicateTitle: idea.title,
        similarityScore: idea.similarity
      };
    }
  }
  
  return { isDuplicate: false };
}
```

## Phase 5: Idea Summary Generation

**File:** `skills/content-pipeline/summarize-idea.js`

```javascript
async function generateIdeaSummary(ideaText, kbSources, socialSources) {
  // Use local LLM (LM Studio) to generate summary
  
  const prompt = `Generate a content idea summary:

Topic: ${ideaText}

Knowledge Base Sources:
${kbSources.map(s => `- ${s.title} (${s.type})`).join('\n')}

Social Discourse:
- YouTube: ${socialSources.youtube.length} recent videos
- Instagram: ${socialSources.instagram.length} trending posts
- Twitter: ${socialSources.twitter.length} recent discussions

Create:
1. Title (catchy, clear)
2. Description (2-3 sentences)
3. Target audience
4. Suggested outline (5-7 bullet points)
5. Platform recommendation (Instagram, TikTok, YouTube, Blog)
6. Content type (reel, carousel, video, article)

Be specific and actionable.`;

  const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:4b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return parseIdeaSummary(data.choices[0].message.content);
}

function parseIdeaSummary(text) {
  // Parse LLM output into structured fields
  return {
    title: extractField(text, 'Title'),
    description: extractField(text, 'Description'),
    targetAudience: extractField(text, 'Target audience'),
    suggestedOutline: extractField(text, 'Suggested outline'),
    platform: extractField(text, 'Platform recommendation'),
    contentType: extractField(text, 'Content type')
  };
}
```

## Phase 6: Mission Control Task Creation

**File:** `skills/content-pipeline/create-task.js`

```javascript
async function createMissionControlTask(idea) {
  const task = {
    id: `content-idea-${Date.now()}`,
    title: idea.title,
    description: `${idea.description}\n\n**Outline:**\n${idea.suggestedOutline}\n\n**Sources:**\n${formatSources(idea.kbSources, idea.socialSources)}`,
    assignedTo: 'ada',
    status: 'queued',
    priority: 'medium',
    module: 'content-creation',
    metadata: {
      ideaId: idea.id,
      platform: idea.platform,
      contentType: idea.contentType
    }
  };
  
  // Add to Mission Control tasks.json
  const tasksPath = '/workspace/mission_control/data/tasks.json';
  const tasks = JSON.parse(fs.readFileSync(tasksPath));
  tasks.push(task);
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
  
  return task.id;
}
```

## Phase 7: Main Pipeline Script

**File:** `skills/content-pipeline/process-idea.js`

```javascript
const kbSearch = require('./kb-search');
const socialSearch = require('./social-search');
const dedup = require('./deduplication');
const summarize = require('./summarize-idea');
const createTask = require('./create-task');
const db = require('./db');

async function processIdea(ideaText, messageId) {
  console.log(`Processing idea: "${ideaText}"`);
  
  // 1. Check for duplicates
  const dupCheck = await dedup.checkDuplicate(ideaText);
  
  if (dupCheck.isDuplicate) {
    console.log(`✗ DUPLICATE (${(dupCheck.similarityScore * 100).toFixed(0)}% similar to "${dupCheck.duplicateTitle}")`);
    
    // Log search
    await db.logIdeaSearch(ideaText, 0, 0, true, dupCheck.duplicateOf);
    
    return {
      success: false,
      reason: 'duplicate',
      summary: `⚠️ This idea is too similar to existing idea: "${dupCheck.duplicateTitle}" (${(dupCheck.similarityScore * 100).toFixed(0)}% match)`
    };
  }
  
  // 2. Search knowledge base
  console.log('Searching knowledge base...');
  const kbSources = await kbSearch.searchKnowledgeBase(ideaText);
  
  // 3. Search social platforms
  console.log('Searching social platforms...');
  const socialSources = await socialSearch.searchAllPlatforms(ideaText);
  
  // 4. Generate summary
  console.log('Generating summary...');
  const summary = await summarize.generateIdeaSummary(ideaText, kbSources, socialSources);
  
  // 5. Generate embedding
  const embedding = await generateEmbedding(ideaText);
  
  // 6. Store idea in database
  const ideaId = await db.insertIdea({
    title: summary.title,
    description: summary.description,
    status: 'proposed',
    platform: summary.platform,
    contentType: summary.contentType,
    targetAudience: summary.targetAudience,
    suggestedOutline: summary.suggestedOutline,
    embedding,
    kbSources: JSON.stringify(kbSources.map(s => s.id)),
    socialSources: JSON.stringify({
      youtube: socialSources.youtube.map(v => v.url),
      instagram: socialSources.instagram.map(p => p.url),
      twitter: socialSources.twitter.map(t => t.url)
    })
  });
  
  // 7. Create Mission Control task
  const taskId = await createTask.createMissionControlTask({
    id: ideaId,
    ...summary,
    kbSources,
    socialSources
  });
  
  // 8. Update idea with task ID
  await db.updateIdea(ideaId, { taskId });
  
  // 9. Log search
  await db.logIdeaSearch(ideaText, kbSources.length, 
    socialSources.youtube.length + socialSources.instagram.length + socialSources.twitter.length,
    false, null);
  
  console.log(`✓ Idea captured: ${summary.title}`);
  
  // 10. Return summary for reply
  return {
    success: true,
    summary: formatReply(summary, kbSources, socialSources, taskId)
  };
}

function formatReply(summary, kbSources, socialSources, taskId) {
  return `✅ **Content Idea Captured**

**${summary.title}**

${summary.description}

**Platform:** ${summary.platform}
**Format:** ${summary.contentType}
**Target:** ${summary.targetAudience}

**Suggested Outline:**
${summary.suggestedOutline}

**Research Sources:**
- Knowledge Base: ${kbSources.length} sources
- YouTube: ${socialSources.youtube.length} videos
- Instagram: ${socialSources.instagram.length} posts
- Twitter: ${socialSources.twitter.length} discussions

**Next Steps:**
Task created in Mission Control (ID: ${taskId})
Assigned to Ada for content creation

Reply "accept idea ${taskId}" to greenlight or "reject idea ${taskId}" to discard.`;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const ideaText = args[0];
  const messageId = args.find(a => a.startsWith('--message-id='))?.split('=')[1];
  
  processIdea(ideaText, messageId).then(result => {
    console.log(result.summary);
  });
}
```

## Phase 8: Idea Lifecycle Management

**Commands for Tyler:**

```javascript
// Accept idea (Tyler replies in thread)
"accept idea [task-id]"
→ Update status to 'accepted'
→ Move MC task to 'active'
→ Notify Ada

// Reject idea
"reject idea [task-id]"
→ Update status to 'rejected'
→ Delete MC task
→ Archive for future reference

// When content is produced
→ Ada marks content as 'published' in content-index.json
→ Pipeline updates idea status to 'produced'
→ Links idea_id to content_id
```

## Deliverables

- [ ] Database schema in AnselAI (content_ideas, idea_searches)
- [ ] Marcus trigger detection for "content idea:" keyword
- [ ] Knowledge base search integration
- [ ] Social platform search (YouTube, Instagram, Twitter)
- [ ] Deduplication engine with 40% similarity threshold
- [ ] Idea summary generator (local LLM)
- [ ] Mission Control task creation
- [ ] Thread reply with formatted summary
- [ ] Idea lifecycle commands (accept/reject)
- [ ] CLI tool: `node process-idea.js "topic"`
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: content idea pipeline with deduplication"

## Testing

1. **Happy path:**
   - Message: "content idea: wedding photography pricing tips"
   - Pipeline searches KB + social
   - No duplicate found
   - Creates idea record + MC task
   - Replies with summary

2. **Duplicate detection:**
   - Message same idea twice
   - Second attempt rejected (>40% similarity)
   - Reply shows existing idea reference

3. **Lifecycle:**
   - Create idea
   - Tyler accepts via "accept idea [id]"
   - Ada produces content
   - Status updates to 'produced'

4. **Social search:**
   - Verify YouTube results relevant
   - Verify Instagram posts trending
   - Verify Twitter discourse recent

## Notes

- Deduplication threshold (40%) can be tuned based on false positive rate
- Social search APIs may require credentials (YouTube Data API, Twitter API v2)
- Summary generation uses local LLM (no API costs)
- Idea embeddings use same model as RAG (nomic-embed-text)
- Mission Control task board shows idea status in real-time
- Future: auto-accept ideas above certain confidence threshold

## Integration Points

**Depends on:**
- AnselAI Phase 1 (PostgreSQL database)
- Knowledge Base RAG (search + embeddings)

**Used by:**
- Marcus (trigger detection)
- Ada (content creation from accepted ideas)
- Mission Control (task visualization)
- Daily briefing (idea performance metrics)
