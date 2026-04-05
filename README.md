# 🟢 ListOFF

### **Ranked Lists on Anything. Verified by AI.**
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Groq Cloud](https://img.shields.io/badge/AI--Engine-GROQ-f3d234?style=for-the-badge)](https://groq.com/)
[![State](https://img.shields.io/badge/Uptime-100%25-00FF00?style=for-the-badge)](https://github.com/Srv532/ListOff)

---

## ⚡ **WHAT IS LISTOFF?**
**ListOFF** is a high-performance generative curation engine designed to deliver accurate, ranked, and fact-verified lists on any topic. Built with a **Neubrutalist** aesthetic, it prioritizes data over fluff and speed over loading spinners.

No more generic AI hallucinations. Every rank in ListOFF is assessed for **seriousness**, cross-referenced by a 5-tier reasoning chain, and pinned to a **Verified Source** link.

---

## 🚀 **CORE ARCHITECTURAL FEATURES**

### 🧠 **1. Multi-Model Reasoning Chain**
ListOFF executes a cascading fallback system. If the primary reasoning model (`Llama-3.3-70B`) is rate-limited, the engine automatically catches the error and drops to `Mixtral-8x7B` or `Llama-3.1-8B` in milliseconds, ensuring you never hit a wall.

### 🚰 **2. Real-Time SSE Streaming**
Say goodbye to the spinning loading wheel. ListOFF opens a **Server-Sent Events (SSE)** tunnel from Node.js to React, providing live heartbeat progress updates (e.g., *"Querying AI"*, *"Ranking results"*) as the data is actually being computed.

### 🛡️ **3. 4-Tier Zero-Stall Caching**
- **Memory Cache**: Instant retrieval for trending topics (~50ms).
- **Session Cache**: Immediate results when moving between dashboard views.
- **Database Backup**: Persistent cataloging on Firebase Firestore.
- **Local Fallback**: Full offline data resiliency if the network drops.

### 📱 **4. Mobile-First Neubrutalism**
The entire UI is built with **Tailwind v4** and **Framer Motion**, optimized for smartphones, tablets, and desktops. High-contrast typography and accessibility-first navigation ensure a premium experience on every device.

---

## 📥 **EXPORT OPTIONS**
- 📄 **Print / PDF**: Beautiful monochrome reports designed for physical printing.
- 📊 **Excel / CSV**: Raw data exports for analysis or database import.
- 🔬 **Traceable Facts**: Every list item includes a clickable source link for verification.

---

## 🛠️ **DEVELOPMENT SETUP**

### **Prerequisites**
- Node.js v18+
- [Groq API Key](https://console.groq.com/)

### **Installation**
1. **Clone the Repo**
   ```bash
   git clone https://github.com/Srv532/ListOff.git
   cd ListOff
   ```

2. **Setup Environment**
   Create a `.env` file in the root directory:
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Install & Run**
   ```bash
   npm install
   # Start the Frontend (Vite)
   npm run dev
   # Start the Backend (Proxy)
   node --env-file=.env server.js
   ```

---

## 🏗️ **TECH STACK**
- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Lucide-React.
- **Backend Proxy**: Node.js, Express, Groq SDK.
- **Persistence**: Firebase Firestore, Browser Storage APIs.

---

## ⚖️ **LICENSE**
Distributed under the MIT License. See `LICENSE` for more information.

---
**Build something beautiful. Stay curious. 🟢**
