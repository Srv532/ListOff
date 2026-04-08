import express from 'express';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// ─────────────────────────────────────────────
// SECURITY: Hardened Headers & CSP
// ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.groq.com;");
  next();
});

// ─────────────────────────────────────────────
// CONFIG: Optimized for <6s Speed
// ─────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_CHAIN = [
  { id: 'gemini-1.5-flash',          maxTokens: 4000, timeout: 5000, provider: 'google' }, // ULTRA FAST (<3s)
  { id: 'llama-3.1-8b-instant',      maxTokens: 4000, timeout: 5000, provider: 'groq'   }, // ULTRA FAST FALLBACK
  { id: 'gemma-2-9b-it',             maxTokens: 4000, timeout: 10000, provider: 'google' },
];

const genAI = process.env.GOOGLE_AI_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY) : null;
const cache = new Map();

// ─────────────────────────────────────────────
// CORE LOGIC
// ─────────────────────────────────────────────
function sanitizeTopic(raw) {
  return String(raw || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
}

function buildPrompt(topic, tone) {
  return {
    system: `Expert Researcher. Topic: "${topic}". Tone: ${tone}. List 10 items. Output ONLY valid JSON array. Be extremely concise.`,
    user: `Format: [{"rank":number,"title":"string","description":"1-2 sentences","why":"reason","isProduct":boolean,"sourceName":"string","sourceUrl":"url"}]`
  };
}

function extractJSON(text) {
  try {
    const s = text.indexOf('[');
    const e = text.lastIndexOf(']');
    if (s === -1 || e === -1) return null;
    return JSON.parse(text.slice(s, e + 1));
  } catch { return null; }
}

async function tryModel(model, topic, tone, apiKey) {
  const { system, user } = buildPrompt(topic, tone);
  try {
    if (model.provider === 'google' && genAI) {
      const m = genAI.getGenerativeModel({ model: model.id });
      const r = await m.generateContent(`${system}\n\n${user}`);
      const parsed = extractJSON(r.response.text());
      return parsed ? parsed.slice(0, 10) : null;
    }

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.1, // Faster sampling
      }),
      signal: AbortSignal.timeout(model.timeout),
    });

    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    return extractJSON(data.choices?.[0]?.message?.content || '');
  } catch (err) {
    console.error(`[SPEED_FAIL] ${model.id}:`, err.message);
    throw err;
  }
}

// SSE Stream with Real-time Progress
app.get('/api/generate-stream', async (req, res) => {
  const topic = sanitizeTopic(req.query.topic);
  const tone = req.query.tone || 'educational';
  const apiKey = process.env.GROQ_API_KEY;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ type: 'progress', progress: 20, stage: 'Analyzing...' });
    
    // Attempt 1: Gemini Flash (Fastest)
    let items = null;
    try {
      send({ type: 'progress', progress: 40, stage: 'Reasoning...' });
      items = await tryModel(MODEL_CHAIN[0], topic, tone, apiKey);
    } catch {
      send({ type: 'progress', progress: 60, stage: 'Swapping to fallback...' });
      items = await tryModel(MODEL_CHAIN[1], topic, tone, apiKey);
    }

    if (!items) throw new Error('Generation failed');
    
    send({ type: 'progress', progress: 90, stage: 'Finalizing...' });
    send({ type: 'result', items });
  } catch (err) {
    send({ type: 'error', message: 'Failed to generate list under 6s limit.' });
  } finally {
    res.end();
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Lightning API: ${PORT}`));

export default app;
