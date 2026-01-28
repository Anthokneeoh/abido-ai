
# 🗣️ Voice Analysis Tool (Gemini 3) 🎙️

A Next.js serverless API powered by **Google Gemini 3 Pro** for advanced speech analysis.  
Uploads audio, validates quality, and returns structured JSON feedback on clarity, confidence, pacing, filler words, and overall delivery.

---

## 🚀 Features
- Audio validation (silence, profanity, unclear speech)
- Full speech analysis across 6 dimensions
- Confidence scoring (0–100) with vibe mapping
- Filler word detection & counts
- Actionable improvement tips + encouragement
- Health check endpoint for monitoring

---

## 🛠 Tech Stack
- Next.js (App Router)
- TypeScript
- Google Generative AI SDK (Gemini 3 Pro)

---

## ⚙️ Usage
```bash
npm install
npm run dev
```

Send a `POST` request with an audio file (`audio` field in form-data).  
Response: JSON with transcript, scores, filler counts, strengths, and improvement tips.

---

## 📡 API Endpoints
- `POST /api/analyze` → Analyze uploaded audio
- `GET /api/analyze` → Health check (status, model, version)

---

## 📄 License
Proprietary – Internal Use
