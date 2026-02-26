# Health Data Pipeline
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** MEDIUM
**Estimated Build:** 3-4 days (Brunel)
**Location:** `/workspace/skills/health-pipeline/`

---

## 1. Overview

Automated health data collection, normalization, analysis, and coaching system. Pulls data from wearable ring, phone health exports, and smart scale into a unified timeline. Morning cron generates AI-powered health summaries with trend analysis and coaching tips.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   health-pipeline/                         │
├──────────────────────────────────────────────────────────┤
│  connectors/                                              │
│  ├─ oura.js          Oura Ring API connector              │
│  ├─ apple-health.js  Apple Health CSV/XML import          │
│  ├─ withings.js      Withings API connector               │
│  └─ manual.js        Manual entry (weight, mood, etc.)    │
│                                                           │
│  timeline.js         Unified JSONL timeline manager        │
│  analyzer.js         LLM-powered trend analysis            │
│  morning-brief.js    Daily health summary generator        │
│  trends.js           Multi-week pattern detection          │
│  db.js               SQLite for indexed queries            │
│  config.json         API keys, thresholds, preferences     │
│  SKILL.md            Integration guide                     │
└──────────────────────────────────────────────────────────┘

Data flow:

  Oura Ring ──┐
  Apple Health─┤──▶ Connectors ──▶ Normalize ──▶ health-timeline.jsonl
  Withings ───┤                                        │
  Manual ─────┘                                        ▼
                                                  Morning Cron
                                                       │
                                                  ┌────┴────┐
                                                  │ Analyzer │
                                                  └────┬────┘
                                                       │
                                                  Daily Summary
                                                  Trend Flags
                                                  Coaching Tips
                                                       │
                                                       ▼
                                                  Telegram
```

## 3. Common Event Format

Every health data point is normalized to this schema:

```json
{
  "ts": "2026-02-26T07:30:00Z",
  "source": "oura",
  "metric": "hrv",
  "value": 45,
  "unit": "ms",
  "context": {
    "period": "sleep",
    "confidence": 0.95
  }
}
```

### Standard Metrics

| Metric | Unit | Sources |
|---|---|---|
| `sleep_duration` | minutes | oura, apple_health |
| `sleep_deep` | minutes | oura, apple_health |
| `sleep_rem` | minutes | oura, apple_health |
| `sleep_light` | minutes | oura, apple_health |
| `sleep_awake` | minutes | oura, apple_health |
| `sleep_score` | 0-100 | oura |
| `hrv` | ms | oura, apple_health |
| `resting_hr` | bpm | oura, apple_health |
| `readiness_score` | 0-100 | oura |
| `activity_score` | 0-100 | oura |
| `steps` | count | oura, apple_health |
| `active_calories` | kcal | oura, apple_health |
| `total_calories` | kcal | oura, apple_health |
| `heart_rate` | bpm | apple_health |
| `workout_duration` | minutes | apple_health |
| `workout_type` | string | apple_health |
| `weight` | kg | withings, manual |
| `body_fat` | percent | withings |
| `muscle_mass` | kg | withings |
| `bmi` | number | withings |
| `blood_pressure_sys` | mmHg | withings |
| `blood_pressure_dia` | mmHg | withings |
| `body_temp` | celsius | oura |
| `spo2` | percent | oura, apple_health |
| `mood` | 1-5 | manual |
| `energy` | 1-5 | manual |
| `stress` | 1-5 | manual |

## 4. Connectors

### 4.1 Oura Ring (`connectors/oura.js`)

```javascript
const config = require('../config.json');

class OuraConnector {
  constructor() {
    this.baseUrl = 'https://api.ouraring.com/v2';
    this.token = process.env.OURA_ACCESS_TOKEN || config.oura?.access_token;
  }

  async fetchSleep(date) {
    // GET /v2/usercollection/daily_sleep?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    const data = await this._fetch(`/usercollection/daily_sleep?start_date=${date}&end_date=${date}`);
    
    return (data.data || []).flatMap(day => [
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'sleep_score', value: day.score, unit: 'score' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'sleep_duration', value: Math.round(day.contributors?.total_sleep / 60), unit: 'minutes' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'sleep_deep', value: Math.round(day.contributors?.deep_sleep / 60), unit: 'minutes' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'sleep_rem', value: Math.round(day.contributors?.rem_sleep / 60), unit: 'minutes' }
    ]);
  }

  async fetchReadiness(date) {
    const data = await this._fetch(`/usercollection/daily_readiness?start_date=${date}&end_date=${date}`);
    
    return (data.data || []).flatMap(day => [
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'readiness_score', value: day.score, unit: 'score' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'hrv', value: day.contributors?.hrv_balance, unit: 'ms' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'resting_hr', value: day.contributors?.resting_heart_rate, unit: 'bpm' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'body_temp', value: day.contributors?.body_temperature, unit: 'celsius_delta' }
    ]);
  }

  async fetchActivity(date) {
    const data = await this._fetch(`/usercollection/daily_activity?start_date=${date}&end_date=${date}`);
    
    return (data.data || []).flatMap(day => [
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'activity_score', value: day.score, unit: 'score' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'steps', value: day.steps, unit: 'count' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'active_calories', value: day.active_calories, unit: 'kcal' },
      { ts: day.day + 'T00:00:00Z', source: 'oura', metric: 'total_calories', value: day.total_burn, unit: 'kcal' }
    ]);
  }

  async fetchAll(date) {
    const [sleep, readiness, activity] = await Promise.all([
      this.fetchSleep(date),
      this.fetchReadiness(date),
      this.fetchActivity(date)
    ]);
    
    return [...sleep, ...readiness, ...activity].filter(e => e.value != null);
  }

  async _fetch(endpoint) {
    if (!this.token) throw new Error('Oura access token not configured');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Oura API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
}

module.exports = OuraConnector;
```

### 4.2 Apple Health (`connectors/apple-health.js`)

```javascript
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

class AppleHealthConnector {
  constructor() {
    this.exportPath = config.apple_health?.export_path;
  }

  // Parse Apple Health XML export
  async importExport(filePath) {
    const xmlPath = filePath || this.exportPath;
    if (!xmlPath || !fs.existsSync(xmlPath)) {
      throw new Error(`Apple Health export not found: ${xmlPath}`);
    }

    const xml = fs.readFileSync(xmlPath, 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const data = parser.parse(xml);

    const records = data.HealthData?.Record || [];
    const events = [];

    for (const record of records) {
      const event = this._mapRecord(record);
      if (event) events.push(event);
    }

    return events;
  }

  // Parse Apple Health CSV export (from shortcuts/apps)
  async importCSV(filePath, metricType) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const headers = lines[0].split(',');
    const events = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());

      const event = {
        ts: new Date(row.date || row.timestamp || row.startDate).toISOString(),
        source: 'apple_health',
        metric: metricType || this._detectMetric(headers),
        value: parseFloat(row.value || row.qty || row.amount),
        unit: row.unit || 'unknown'
      };

      if (!isNaN(event.value)) events.push(event);
    }

    return events;
  }

  _mapRecord(record) {
    const typeMap = {
      'HKQuantityTypeIdentifierStepCount': { metric: 'steps', unit: 'count' },
      'HKQuantityTypeIdentifierHeartRate': { metric: 'heart_rate', unit: 'bpm' },
      'HKQuantityTypeIdentifierActiveEnergyBurned': { metric: 'active_calories', unit: 'kcal' },
      'HKQuantityTypeIdentifierDistanceWalkingRunning': { metric: 'distance', unit: 'km' },
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { metric: 'hrv', unit: 'ms' },
      'HKQuantityTypeIdentifierOxygenSaturation': { metric: 'spo2', unit: 'percent' },
      'HKQuantityTypeIdentifierBodyMass': { metric: 'weight', unit: 'kg' },
      'HKQuantityTypeIdentifierRestingHeartRate': { metric: 'resting_hr', unit: 'bpm' }
    };

    const mapping = typeMap[record.type];
    if (!mapping) return null;

    return {
      ts: new Date(record.startDate || record.creationDate).toISOString(),
      source: 'apple_health',
      metric: mapping.metric,
      value: parseFloat(record.value),
      unit: mapping.unit
    };
  }

  _detectMetric(headers) {
    const headerStr = headers.join(' ').toLowerCase();
    if (headerStr.includes('step')) return 'steps';
    if (headerStr.includes('heart')) return 'heart_rate';
    if (headerStr.includes('sleep')) return 'sleep_duration';
    if (headerStr.includes('weight')) return 'weight';
    return 'unknown';
  }
}

module.exports = AppleHealthConnector;
```

### 4.3 Withings (`connectors/withings.js`)

```javascript
class WithingsConnector {
  constructor() {
    this.baseUrl = 'https://wbsapi.withings.net';
    this.accessToken = process.env.WITHINGS_ACCESS_TOKEN || config.withings?.access_token;
    this.refreshToken = process.env.WITHINGS_REFRESH_TOKEN || config.withings?.refresh_token;
  }

  async fetchMeasurements(date) {
    // Withings API: /measure - getmeas
    const startTs = new Date(date + 'T00:00:00Z').getTime() / 1000;
    const endTs = startTs + 86400;

    const data = await this._fetch('/measure', {
      action: 'getmeas',
      startdate: startTs,
      enddate: endTs,
      category: 1 // real measurements only
    });

    const events = [];
    const measureGroups = data.body?.measuregrps || [];

    for (const group of measureGroups) {
      const ts = new Date(group.date * 1000).toISOString();
      
      for (const measure of group.measures) {
        const event = this._mapMeasure(measure, ts);
        if (event) events.push(event);
      }
    }

    return events;
  }

  _mapMeasure(measure, ts) {
    // Withings measure types
    const typeMap = {
      1: { metric: 'weight', unit: 'kg' },
      4: { metric: 'height', unit: 'cm' },
      5: { metric: 'body_fat', unit: 'percent' },
      6: { metric: 'body_fat_mass', unit: 'kg' },
      8: { metric: 'body_fat_free_mass', unit: 'kg' },
      9: { metric: 'blood_pressure_dia', unit: 'mmHg' },
      10: { metric: 'blood_pressure_sys', unit: 'mmHg' },
      11: { metric: 'heart_rate', unit: 'bpm' },
      76: { metric: 'muscle_mass', unit: 'kg' },
      77: { metric: 'hydration', unit: 'kg' },
      88: { metric: 'bone_mass', unit: 'kg' },
      91: { metric: 'pulse_wave_velocity', unit: 'm/s' }
    };

    const mapping = typeMap[measure.type];
    if (!mapping) return null;

    // Withings stores values as value * 10^unit (e.g., 7500 * 10^-2 = 75.00 kg)
    const value = measure.value * Math.pow(10, measure.unit);

    return {
      ts,
      source: 'withings',
      metric: mapping.metric,
      value: Math.round(value * 100) / 100,
      unit: mapping.unit
    };
  }

  async _fetch(endpoint, params) {
    if (!this.accessToken) throw new Error('Withings access token not configured');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();
    
    if (data.status !== 0) {
      if (data.status === 401) {
        // Token expired, try refresh
        await this._refreshToken();
        return this._fetch(endpoint, params); // retry once
      }
      throw new Error(`Withings API error: status ${data.status}`);
    }

    return data;
  }

  async _refreshToken() {
    // OAuth2 token refresh flow
    const response = await fetch(`${this.baseUrl}/v2/oauth2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'refresh_token',
        client_id: process.env.WITHINGS_CLIENT_ID,
        client_secret: process.env.WITHINGS_CLIENT_SECRET,
        refresh_token: this.refreshToken
      })
    });

    const data = await response.json();
    if (data.status === 0) {
      this.accessToken = data.body.access_token;
      this.refreshToken = data.body.refresh_token;
      // TODO: persist new tokens
    }
  }
}

module.exports = WithingsConnector;
```

### 4.4 Manual Entry (`connectors/manual.js`)

```javascript
class ManualConnector {
  // Parse manual entries from CLI or Telegram
  static parseEntry(text) {
    // Formats:
    // "weight 185.5 lbs"
    // "mood 4"
    // "energy 3 stress 2"
    // "workout lifting 45min"
    
    const events = [];
    const ts = new Date().toISOString();
    
    const patterns = [
      { re: /weight\s+([\d.]+)\s*(lbs?|kg)?/i, metric: 'weight', unit: match => (match[2] || 'lbs').toLowerCase() === 'lbs' ? 'kg' : 'kg', convert: (v, u) => u === 'lbs' ? v * 0.453592 : v },
      { re: /mood\s+([1-5])/i, metric: 'mood', unit: () => 'scale_1_5' },
      { re: /energy\s+([1-5])/i, metric: 'energy', unit: () => 'scale_1_5' },
      { re: /stress\s+([1-5])/i, metric: 'stress', unit: () => 'scale_1_5' },
      { re: /sleep\s+([\d.]+)\s*h/i, metric: 'sleep_duration', unit: () => 'minutes', convert: (v) => v * 60 },
      { re: /steps\s+([\d,]+)/i, metric: 'steps', unit: () => 'count', convert: (v) => parseInt(String(v).replace(/,/g, '')) },
      { re: /workout\s+(\w+)\s+([\d.]+)\s*min/i, metric: 'workout_duration', unit: () => 'minutes', context: (match) => ({ workout_type: match[1] }) }
    ];
    
    for (const p of patterns) {
      const match = text.match(p.re);
      if (match) {
        let value = parseFloat(match[1] || match[2]);
        if (p.convert) value = p.convert(value, match[2]);
        
        events.push({
          ts,
          source: 'manual',
          metric: p.metric,
          value: Math.round(value * 100) / 100,
          unit: typeof p.unit === 'function' ? p.unit(match) : p.unit,
          ...(p.context ? { context: p.context(match) } : {})
        });
      }
    }
    
    return events;
  }
}

module.exports = ManualConnector;
```

## 5. Unified Timeline (`timeline.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const TIMELINE_PATH = path.join(config.data_dir, 'health-timeline.jsonl');

class HealthTimeline {
  constructor() {
    const dir = path.dirname(TIMELINE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Append events to timeline (append-only)
  append(events) {
    const lines = events
      .filter(e => e.value != null && !isNaN(e.value))
      .map(e => JSON.stringify(e))
      .join('\n');
    
    if (lines) {
      fs.appendFileSync(TIMELINE_PATH, lines + '\n');
    }
    
    return events.length;
  }

  // Read events by date range
  read(options = {}) {
    if (!fs.existsSync(TIMELINE_PATH)) return [];
    
    const content = fs.readFileSync(TIMELINE_PATH, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    
    let events = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    
    // Filter by date range
    if (options.from) events = events.filter(e => e.ts >= options.from);
    if (options.to) events = events.filter(e => e.ts <= options.to);
    
    // Filter by metric
    if (options.metric) events = events.filter(e => e.metric === options.metric);
    
    // Filter by source
    if (options.source) events = events.filter(e => e.source === options.source);
    
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  // Get latest value for each metric
  getLatest() {
    const events = this.read();
    const latest = {};
    
    for (const event of events) {
      if (!latest[event.metric] || event.ts > latest[event.metric].ts) {
        latest[event.metric] = event;
      }
    }
    
    return latest;
  }

  // Get daily averages for a metric over a date range
  getDailyAverages(metric, days = 30) {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    const events = this.read({ metric, from });
    
    const byDay = {};
    for (const event of events) {
      const day = event.ts.substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(event.value);
    }
    
    return Object.entries(byDay).map(([day, values]) => ({
      date: day,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Get timeline stats
  getStats() {
    const events = this.read();
    const metrics = new Set(events.map(e => e.metric));
    const sources = new Set(events.map(e => e.source));
    const firstTs = events.length > 0 ? events[0].ts : null;
    const lastTs = events.length > 0 ? events[events.length - 1].ts : null;
    
    return {
      total_events: events.length,
      unique_metrics: metrics.size,
      metrics: [...metrics],
      sources: [...sources],
      date_range: { first: firstTs, last: lastTs }
    };
  }
}

module.exports = HealthTimeline;
```

## 6. Morning Health Brief (`morning-brief.js`)

```javascript
const HealthTimeline = require('./timeline');
const TrendAnalyzer = require('./trends');
const { callLlm } = require('/workspace/skills/llm-router/router');

async function generateMorningBrief() {
  const timeline = new HealthTimeline();
  const trends = new TrendAnalyzer(timeline);

  // Get last 24h of data
  const recentFrom = new Date(Date.now() - 86400000).toISOString();
  const recent = timeline.read({ from: recentFrom });

  // Get latest values
  const latest = timeline.getLatest();

  // Get 7-day trends
  const weekTrends = trends.analyze(7);

  // Get 30-day trends
  const monthTrends = trends.analyze(30);

  // Build context for LLM
  const healthContext = `
LAST 24 HOURS:
${recent.map(e => `- ${e.metric}: ${e.value} ${e.unit} (${e.source})`).join('\n')}

LATEST VALUES:
${Object.entries(latest).map(([metric, e]) => `- ${metric}: ${e.value} ${e.unit} (${e.ts.substring(0, 10)})`).join('\n')}

7-DAY TRENDS:
${weekTrends.map(t => `- ${t.metric}: ${t.direction} (${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}${t.unit})`).join('\n')}

30-DAY TRENDS:
${monthTrends.map(t => `- ${t.metric}: ${t.direction} (${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}${t.unit})`).join('\n')}

FLAGS:
${trends.getFlags().map(f => `- ⚠️ ${f.message}`).join('\n') || 'None'}
`;

  // Generate AI summary
  const result = await callLlm({
    model: 'lmstudio/gemma-3-12b-it',
    systemPrompt: `You are a health analyst providing a morning health briefing. Be concise, actionable, and encouraging. Focus on:
1. Sleep quality and recovery
2. Activity and fitness trends
3. Body composition changes (if data available)
4. Specific coaching tips based on the data
5. Flags or concerns that need attention

Keep it under 200 words. Use a warm, motivating tone. Don't repeat raw numbers, interpret them.`,
    prompt: healthContext,
    maxTokens: 500,
    temperature: 0.5,
    agent: 'marcus',
    taskType: 'health_brief'
  });

  return {
    summary: result.text,
    data: {
      recent: recent.length,
      latest,
      weekTrends,
      monthTrends,
      flags: trends.getFlags()
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = { generateMorningBrief };
```

## 7. Trend Analysis (`trends.js`)

```javascript
const HealthTimeline = require('./timeline');

class TrendAnalyzer {
  constructor(timeline) {
    this.timeline = timeline || new HealthTimeline();
    this.thresholds = {
      sleep_score: { low: 60, high: 85, unit: 'score' },
      hrv: { low: 20, high: 60, unit: 'ms' },
      resting_hr: { low: 45, high: 75, unit: 'bpm' },
      readiness_score: { low: 60, high: 85, unit: 'score' },
      steps: { low: 3000, high: 10000, unit: 'count' },
      sleep_duration: { low: 360, high: 540, unit: 'min' },
      weight: { change_threshold_pct: 2, unit: 'kg' }
    };
  }

  // Analyze trends for a given number of days
  analyze(days) {
    const metrics = ['sleep_score', 'hrv', 'resting_hr', 'readiness_score', 'steps', 'sleep_duration', 'weight', 'body_fat'];
    const trends = [];

    for (const metric of metrics) {
      const dailyAvgs = this.timeline.getDailyAverages(metric, days);
      if (dailyAvgs.length < 2) continue;

      const first = dailyAvgs.slice(0, Math.ceil(dailyAvgs.length / 2));
      const second = dailyAvgs.slice(Math.ceil(dailyAvgs.length / 2));

      const firstAvg = first.reduce((s, d) => s + d.avg, 0) / first.length;
      const secondAvg = second.reduce((s, d) => s + d.avg, 0) / second.length;
      const change = secondAvg - firstAvg;

      let direction = 'stable';
      const threshold = Math.abs(firstAvg * 0.05); // 5% change threshold
      if (change > threshold) direction = 'up';
      if (change < -threshold) direction = 'down';

      trends.push({
        metric,
        direction,
        change: Math.round(change * 10) / 10,
        unit: this.thresholds[metric]?.unit || '',
        firstPeriodAvg: Math.round(firstAvg * 10) / 10,
        secondPeriodAvg: Math.round(secondAvg * 10) / 10,
        dataPoints: dailyAvgs.length
      });
    }

    return trends;
  }

  // Get actionable flags
  getFlags() {
    const flags = [];
    const latest = this.timeline.getLatest();

    // Poor sleep streak (3+ days below threshold)
    const sleepScores = this.timeline.getDailyAverages('sleep_score', 7);
    const poorSleepDays = sleepScores.filter(d => d.avg < (this.thresholds.sleep_score?.low || 60));
    if (poorSleepDays.length >= 3) {
      flags.push({
        severity: 'warn',
        metric: 'sleep_score',
        message: `Poor sleep streak: ${poorSleepDays.length} of last ${sleepScores.length} days below ${this.thresholds.sleep_score.low}`
      });
    }

    // HRV drop
    const hrvTrend = this.analyze(14).find(t => t.metric === 'hrv');
    if (hrvTrend && hrvTrend.direction === 'down' && Math.abs(hrvTrend.change) > 5) {
      flags.push({
        severity: 'warn',
        metric: 'hrv',
        message: `HRV dropping: ${hrvTrend.change}ms over 2 weeks. May indicate accumulated stress or overtraining.`
      });
    }

    // Weight change > threshold
    const weightTrend = this.analyze(30).find(t => t.metric === 'weight');
    if (weightTrend && Math.abs(weightTrend.change) > 2) {
      const direction = weightTrend.change > 0 ? 'gain' : 'loss';
      flags.push({
        severity: 'info',
        metric: 'weight',
        message: `Weight ${direction}: ${Math.abs(weightTrend.change).toFixed(1)}kg over 30 days`
      });
    }

    // Low activity streak
    const stepData = this.timeline.getDailyAverages('steps', 7);
    const lowActivityDays = stepData.filter(d => d.avg < (this.thresholds.steps?.low || 3000));
    if (lowActivityDays.length >= 3) {
      flags.push({
        severity: 'warn',
        metric: 'steps',
        message: `Low activity: ${lowActivityDays.length} of last ${stepData.length} days under ${this.thresholds.steps.low} steps`
      });
    }

    // Cross-reference: poor sleep + low activity
    if (poorSleepDays.length >= 2 && lowActivityDays.length >= 2) {
      flags.push({
        severity: 'warn',
        metric: 'cross_reference',
        message: 'Poor sleep AND low activity detected together. Consider light exercise to improve sleep quality.'
      });
    }

    return flags;
  }
}

module.exports = TrendAnalyzer;
```

## 8. Configuration (`config.json`)

```json
{
  "data_dir": "/Volumes/reeseai-memory/data/health",
  "connectors": {
    "oura": {
      "enabled": false,
      "access_token_env": "OURA_ACCESS_TOKEN"
    },
    "apple_health": {
      "enabled": false,
      "export_path": null
    },
    "withings": {
      "enabled": false,
      "access_token_env": "WITHINGS_ACCESS_TOKEN",
      "refresh_token_env": "WITHINGS_REFRESH_TOKEN",
      "client_id_env": "WITHINGS_CLIENT_ID",
      "client_secret_env": "WITHINGS_CLIENT_SECRET"
    },
    "manual": {
      "enabled": true
    }
  },
  "morning_brief": {
    "enabled": true,
    "model": "lmstudio/gemma-3-12b-it",
    "delivery_channel": "telegram"
  },
  "thresholds": {
    "sleep_score_low": 60,
    "hrv_low": 20,
    "steps_low": 3000,
    "poor_streak_days": 3,
    "weight_change_threshold_kg": 2
  }
}
```

## 9. Cron Integration

```json
{
  "name": "health-morning-brief",
  "schedule": { "kind": "cron", "expr": "0 6 * * *", "tz": "America/New_York" },
  "payload": { "kind": "agentTurn", "message": "Generate morning health brief: pull latest data from all configured connectors, run trend analysis, deliver summary to Tyler" },
  "sessionTarget": "isolated",
  "delivery": { "mode": "announce" }
}
```

## 10. CLI Interface

```bash
# Pull latest data from all sources
node health-pipeline/pull.js

# Pull from specific source
node health-pipeline/pull.js --source oura

# Manual entry
node health-pipeline/manual.js "weight 185.5 lbs mood 4 energy 3"

# View timeline
node health-pipeline/timeline.js --last 7d
node health-pipeline/timeline.js --metric sleep_score --last 30d

# View trends
node health-pipeline/trends.js --days 30

# Generate morning brief
node health-pipeline/morning-brief.js

# View stats
node health-pipeline/timeline.js --stats
```

## 11. File Structure

```
/workspace/skills/health-pipeline/
├── connectors/
│   ├── oura.js            # Oura Ring API
│   ├── apple-health.js    # Apple Health CSV/XML import
│   ├── withings.js        # Withings API
│   └── manual.js          # Manual entry parser
├── timeline.js            # Unified JSONL timeline
├── analyzer.js            # LLM-powered analysis
├── morning-brief.js       # Daily health summary
├── trends.js              # Multi-week pattern detection
├── pull.js                # Pull from all sources CLI
├── db.js                  # SQLite for indexed queries
├── config.json            # API keys, thresholds
├── SKILL.md               # Integration guide
├── README.md              # Overview
└── package.json           # Dependencies
```

## 12. Privacy Note

Health data is classified as **Confidential** (Tier 1). It is:
- Never shared in group chats
- Never included in external communications
- Stored only on local drives (not cloud-synced)
- Redacted from logs (the logging system's redaction patterns should include health metrics)

## 13. Testing Checklist

- [ ] Oura connector: fetches sleep, readiness, activity
- [ ] Apple Health: imports CSV and XML exports
- [ ] Withings: fetches body measurements
- [ ] Manual: parses weight, mood, energy, stress entries
- [ ] Timeline: append-only, read with filters
- [ ] Timeline: daily averages calculation
- [ ] Trends: detects up/down/stable correctly
- [ ] Trends: flags poor sleep streaks
- [ ] Trends: flags HRV drops
- [ ] Trends: cross-references sleep + activity
- [ ] Morning brief: generates coherent summary
- [ ] Morning brief: delivers to Telegram
- [ ] Manual entry via Telegram trigger works
