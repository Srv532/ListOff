# ⚡ ListOFF — High-Performance Generative Curation

ListOFF is a state-of-the-art generative curation engine designed to deliver ultra-fast, ranked lists on any topic using deep data insights and AI precision. Built for speed, security, and aesthetics.

## 🚀 Speed Architecture (<6s)
ListOFF is engineered for near-instant response times using a multi-tier reasoning strategy:
- **Tier 1 (Lightning):** `gemini-1.5-flash` for <3s generative speed.
- **Tier 2 (Fallback):** `llama-3.1-8b-instant` via Groq for high-availability redundancy.
- **Tier 3 (Deep):** `gemma-2-9b-it` for complex, nuanced topics.

## 🛡️ Security Hardening
- **Secrets Management:** Zero-leak architecture using `.env.local` for all API keys.
- **SSRF Protection:** IP-based private range blocking for all external source links.
- **Input Sanitization:** Robust protection against XSS and template injection.
- **Code Protection:** Integrated anti-debug and inspect-protection measures.

## ⚡ Tech Stack
- **Frontend:** React 19 + Framer Motion + Tailwind v4
- **Backend:** Node.js Express (Serverless Ready)
- **AI Core:** Google Generative AI + Groq SDK
- **Persistence:** Firebase Firestore + LocalStorage Fallback

## 🛠️ Installation
1. Clone the repository.
2. Install dependencies: `npm install`
3. Setup `.env.local`:
   ```env
   GOOGLE_AI_KEY=your_key
   GROQ_API_KEY=your_key
   VITE_FIREBASE_API_KEY=your_key
   ... and other Firebase vars
   ```
4. Run servers:
   - Backend: `npm run server`
   - Frontend: `npm run dev`

## 🎨 Design Philosophy
ListOFF uses a **Neubrutalist** design language — bold borders, high-contrast typography, and vibrant secondary colors. It's meant to feel alive, responsive, and authoritative.

---
*Verified by AI. Curated by You.*
