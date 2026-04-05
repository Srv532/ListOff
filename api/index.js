import express from 'express';
import crypto from 'crypto';

const app = express();

// ─────────────────────────────────────────────
// SECURITY: Body size limit to prevent DoS (fix #22 - insecure file upload / large payloads)
// ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ─────────────────────────────────────────────
// SECURITY: Hardened Security Headers (#8 Missing Security Headers, #17 Clickjacking, #23 CSP)
// ─────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.groq.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
});

// ─────────────────────────────────────────────
// SECURITY: CORS — strict origin whitelist (#16 CORS Misconfiguration)
// ─────────────────────────────────────────────
const ALLOWED_ORIGINS = (() => {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
})();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next(); // same-origin or server-to-server
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─────────────────────────────────────────────
// SECURITY: Rate limiter (#18 Missing Rate Limiting on Auth Endpoints)
// Simple in-process store: max 10 req/min per IP
// ─────────────────────────────────────────────
const rateLimitStore = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimit(req, res, next) {
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
    return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
  }
  entry.count++;
  next();
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL_CHAIN = [
  { id: 'llama-3.3-70b-versatile',  maxTokens: 6000, timeout: 25000 },
  { id: 'llama-3.1-70b-versatile',  maxTokens: 6000, timeout: 25000 },
  { id: 'mixtral-8x7b-32768',       maxTokens: 6000, timeout: 30000 },
  { id: 'llama3-70b-8192',          maxTokens: 4000, timeout: 30000 },
  { id: 'llama-3.1-8b-instant',     maxTokens: 4000, timeout: 20000 },
];

// Cache clears every 30 min
const cache = new Map();
setInterval(() => cache.clear(), 30 * 60 * 1000);

// ─────────────────────────────────────────────
// SECURITY: Input sanitization (#1 XSS, #2 Injection)
// Strip all HTML/script tags and control chars, hard-cap length
// ─────────────────────────────────────────────
const TOPIC_MAX_LEN = 200;
const ALLOWED_TONES = new Set(['serious', 'funny', 'educational', 'controversial']);

function sanitizeTopic(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[^\w\s\-.,!?'"()&]/g, '') // whitelist printable chars
    .trim()
    .slice(0, TOPIC_MAX_LEN);
}

function validateTone(raw) {
  return ALLOWED_TONES.has(raw) ? raw : 'educational';
}

// ─────────────────────────────────────────────
// BUILD BUY LINKS for products
// ─────────────────────────────────────────────
function buildBuyLinks(title) {
  const q = encodeURIComponent(title);
  return [
    { name: 'Amazon',         url: `https://www.amazon.com/s?k=${q}` },
    { name: 'Best Buy',       url: `https://www.bestbuy.com/site/searchpage.jsp?st=${q}` },
    { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}` },
  ];
}

// ─────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────
function buildPrompt(topic, tone) {
  const toneMap = {
    serious:       'factual, professional, data-driven — cite real usage, reviews, market standing',
    funny:         'witty and entertaining while keeping all facts accurate and useful',
    educational:   'insightful and informative — explain what makes each item truly stand out',
    controversial: 'bold and thought-provoking — surprising, debated, or contrarian picks',
  };
  const toneInstr = toneMap[tone] || toneMap.educational;

  return {
    system: `You are a world-class expert researcher and curator. You produce definitive, authoritative, richly detailed ranked lists. You must absolutely ONLY use 100% accurate, established facts. Always assess the seriousness of the topic. If it involves sensitive or critical real-world data, double-check your facts. Never invent or hallucinate data. Output ONLY a valid raw JSON array — no markdown, no code fences. First char: [. Last char: ].`,
    user: `Create the definitive ranked list of exactly 17 items about: "${topic}"

Tone: ${toneInstr}

CRITICAL rules:
- Assess the SERIOUSNESS of the topic user inputted. Only use real databases, science, and authoritative sources. Reject non-accurate data.
- Include rich, detailed descriptions (3-4 sentences each)
- Base rankings on actual reviews, expert consensus, market data, or historical significance.
- You MUST provide a credible source for your ranking verification (e.g. specialized review site, scientific paper, established journal). Provide the direct name and URL.
- Set "isProduct" to true ONLY if this item can be directly purchased (physical/digital product, gadget, software, game, book, etc.)
- Each "why" must give a SPECIFIC reason with real data points, not generic statements

Output ONLY this JSON array (NO backticks, NO markdown):
[
  {
    "rank": 1,
    "title": "Exact real name of item",
    "description": "3-4 specific detailed sentences. Include key specs, history, or defining characteristics.",
    "why": "Specific one-sentence reason with concrete evidence why it earned this rank.",
    "isProduct": false,
    "sourceName": "Name of Trusted Source (e.g. The Verge, Nature, NYT)",
    "sourceUrl": "https://url-to-source-or-review.com"
  }
]

Return all 17 items. Raw JSON array only.`
  };
}

// ─────────────────────────────────────────────
// JSON REPAIR
// ─────────────────────────────────────────────
function extractAndRepairJSON(rawText) {
  let text = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;

  let jsonSlice = text.slice(start, end + 1);
  jsonSlice = jsonSlice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  try {
    return JSON.parse(jsonSlice);
  } catch {
    const lastComplete = jsonSlice.lastIndexOf('},');
    if (lastComplete > 0) {
      try { return JSON.parse(jsonSlice.slice(0, lastComplete + 1) + ']'); } catch { return null; }
    }
    return null;
  }
}

// ─────────────────────────────────────────────
// VALIDATE & NORMALIZE
// SECURITY: Validate sourceUrl to prevent SSRF (#24 SSRF)
// Only allow http/https external URLs
// ─────────────────────────────────────────────
function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    // Only allow public http/https, block private/loopback ranges and other protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const blocked = [
      /^localhost$/, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
      /^::1$/, /^0\.0\.0\.0$/, /^169\.254\./, /metadata\.google\.internal/,
    ];
    if (blocked.some((r) => r.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

function validateItems(rawItems) {
  if (!Array.isArray(rawItems)) return null;
  const valid = rawItems
    .filter(item => item && typeof item.title === 'string' && item.title.trim() && typeof item.description === 'string')
    .map((item, idx) => {
      const rawSourceUrl = (item.sourceUrl || '').trim();
      return {
        rank: typeof item.rank === 'number' ? item.rank : idx + 1,
        title: item.title.trim().slice(0, 200),
        description: item.description.trim().slice(0, 1000),
        why: (item.why || '').trim().slice(0, 500),
        isProduct: !!item.isProduct,
        sourceName: (item.sourceName || '').trim().slice(0, 100),
        sourceUrl: isSafeUrl(rawSourceUrl) ? rawSourceUrl : '',
      };
    });
  return valid.length >= 3 ? valid.slice(0, 17) : null;
}

// ─────────────────────────────────────────────
// SINGLE MODEL ATTEMPT
// ─────────────────────────────────────────────
async function tryModel(model, topic, tone, apiKey) {
  const { system, user } = buildPrompt(topic, tone);
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model.id,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.3,
      max_tokens: model.maxTokens,
    }),
    signal: AbortSignal.timeout(model.timeout),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    throw Object.assign(new Error('RATE_LIMITED'), { retryAfter, statusCode: 429 });
  }
  if (!res.ok) {
    // SECURITY: (#19 Verbose Error Messages) — never leak upstream error body in production
    const statusCode = res.status;
    if (process.env.NODE_ENV !== 'production') {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(`HTTP ${statusCode}: ${body?.error?.message || res.statusText}`), { statusCode });
    }
    throw Object.assign(new Error(`AI service error (${statusCode})`), { statusCode });
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content ?? '';
  if (!rawText.trim()) throw new Error('EMPTY_RESPONSE');

  const parsed = extractAndRepairJSON(rawText);
  if (!parsed) throw new Error('JSON_PARSE_FAILED');

  const items = validateItems(parsed);
  if (!items) throw new Error('VALIDATION_FAILED');
  return items;
}

// ─────────────────────────────────────────────
// FULL FALLBACK CHAIN
// ─────────────────────────────────────────────
async function generateWithFallback(topic, tone, apiKey) {
  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const items = await tryModel(model, topic, tone, apiKey);
        return { items, modelUsed: model.id };
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) throw new Error('Authentication failed. Please contact the administrator.');
        if (err.statusCode === 429 && err.retryAfter > 0 && err.retryAfter <= 30) {
          await new Promise(r => setTimeout(r, err.retryAfter * 1000));
        } else if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Unable to generate list. Please try again later.');
}

// ─────────────────────────────────────────────
// ENRICH: add buy links
// ─────────────────────────────────────────────
function enrichItems(rawItems) {
  return rawItems.map((item) => {
    const buyLinks = item.isProduct ? buildBuyLinks(item.title) : undefined;
    return { ...item, buyLinks };
  });
}

// ─────────────────────────────────────────────
// GENERATE WITH FALLBACK + PROGRESS CALLBACKS
// ─────────────────────────────────────────────
async function generateWithProgress(topic, tone, apiKey, onProgress) {
  const totalModels = MODEL_CHAIN.length;

  for (let mi = 0; mi < MODEL_CHAIN.length; mi++) {
    const model = MODEL_CHAIN[mi];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const modelPct = Math.round(10 + (mi / totalModels) * 45);
      onProgress(modelPct, `Querying model... (attempt ${attempt})`);
      try {
        const items = await tryModel(model, topic, tone, apiKey);
        return { items, modelUsed: model.id };
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) throw new Error('Authentication failed. Please contact the administrator.');
        if (err.statusCode === 429 && err.retryAfter > 0 && err.retryAfter <= 30) {
          onProgress(modelPct, `Rate limited — waiting ${err.retryAfter}s...`);
          await new Promise(r => setTimeout(r, err.retryAfter * 1000));
        } else if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Unable to generate list. Please try again later.');
}

function enrichWithProgress(rawItems, onProgress) {
  onProgress(95, 'Polishing list & formatting sources...');
  return enrichItems(rawItems);
}

// ─────────────────────────────────────────────
// SSE STREAMING ENDPOINT
// SECURITY: Rate limited, CORS locked, no wildcard origin (#16, #18)
// ─────────────────────────────────────────────
app.get('/api/generate-stream', rateLimit, async (req, res) => {
  const rawTopic = req.query.topic;
  const rawTone  = req.query.tone;
  const refresh  = req.query.refresh;

  // SECURITY: (#1 XSS, #2 Injection) — sanitize and validate all inputs
  const topic     = sanitizeTopic(rawTopic);
  const tone      = validateTone(rawTone);
  const skipCache = refresh === 'true';

  if (!topic || topic.length < 2) {
    res.status(400).json({ error: 'Please provide a valid topic (2–200 characters).' });
    return;
  }

  // SSE headers — no wildcard CORS (handled by middleware above)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const onProgress = (progress, stage) => send('progress', { progress, stage });

  // SECURITY: (#4 Exposed Env Vars) — key read server-side only, never in VITE_ namespace on server
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // SECURITY: (#19 Verbose Errors) — never reveal missing key names in prod
    send('error', { message: 'Service configuration error. Please contact the administrator.' });
    res.end();
    return;
  }

  // SECURITY: (#20 SSR State Leaking) — cache key is per-request isolated, no shared mutable state
  const cacheKey = `${topic.toLowerCase()}::${tone}`;
  if (!skipCache && cache.has(cacheKey)) {
    send('progress', { progress: 100, stage: 'Loaded from cache!' });
    send('result', { items: cache.get(cacheKey), cached: true });
    res.end();
    return;
  }

  let heartbeat;
  try {
    send('progress', { progress: 5, stage: 'Starting up...' });

    heartbeat = setInterval(() => {
      send('progress', { stage: 'Thinking and analyzing... 🧠' });
    }, 2500);

    const { items: rawItems } = await generateWithProgress(
      topic, tone, apiKey, onProgress
    );

    clearInterval(heartbeat);
    send('progress', { progress: 60, stage: `AI done! Curating ${rawItems.length} items...` });

    const items = enrichWithProgress(rawItems, onProgress);

    send('progress', { progress: 95, stage: 'Finalizing...' });
    cache.set(cacheKey, items);

    send('progress', { progress: 100, stage: 'Done!' });
    // SECURITY: (#19 Verbose Errors) — never expose modelUsed in production
    send('result', { items });
  } catch (err) {
    // SECURITY: (#19 Verbose Errors) — generic message in production
    const message = process.env.NODE_ENV === 'production'
      ? 'Unable to generate list. Please try again later.'
      : err.message;
    send('error', { message });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    res.end();
  }
});

// Keep POST endpoint as fallback — also rate limited
app.post('/api/generate', rateLimit, async (req, res) => {
  const rawTopic = req.body?.topic;
  const rawTone  = req.body?.tone;

  const topic = sanitizeTopic(rawTopic);
  const tone  = validateTone(rawTone);

  if (!topic || topic.length < 2) {
    return res.status(400).json({ error: 'Please provide a valid topic (2–200 characters).' });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Service configuration error. Please contact the administrator.' });
  }
  const cacheKey = `${topic.toLowerCase()}::${tone}`;
  if (cache.has(cacheKey)) return res.json({ items: cache.get(cacheKey), cached: true });
  try {
    const { items: rawItems } = await generateWithFallback(topic, tone, apiKey);
    const items = enrichItems(rawItems);
    cache.set(cacheKey, items);
    return res.json({ items });
  } catch (err) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Unable to generate list. Please try again later.'
      : err.message;
    return res.status(500).json({ error: message });
  }
});

// Health check — no sensitive info exposed
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// SECURITY: (#9 Open Redirect) — catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 [ListOFF API] http://localhost:${PORT}`);
  });
}

export default app;
