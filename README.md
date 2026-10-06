# 🗣️ Abido AI

**Abido AI is a voice coaching tool that helps you improve your public speaking.**

Record a short speech and get AI-powered feedback on your confidence, pacing, clarity, filler words, energy, and overall delivery.

## ✨ What It Does

- 🎙️ Records your speech directly in the browser
- 📝 Generates a transcript of your speech
- 📊 Scores your delivery across key speaking skills
- 💬 Identifies filler words and speaking patterns
- 💡 Highlights your strengths and areas for improvement
- 🚀 Provides practical feedback to help you become a better speaker

## 📋 What You Get

After each recording, Abido AI provides:

- **Confidence Score** from 0–100
- **Overall Vibe** such as Confident, Natural, Nervous, or Rushed
- **Energy Level**
- **Filler Words** and their frequency
- **Strength** highlighting what you did well
- **Priority Fix** identifying what to work on next
- **Encouragement** to help you keep improving
- **Transcript** of your speech

## 🛠️ Built With

- Next.js
- TypeScript
- React
- Novita AI
- Xiaomi MiMo V2.6 Flash

## 🚀 Getting Started

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```

### Environment Variables

Create a `.env.local` file and add your Novita AI API key:

```env
NOVITA_API_KEY=your_api_key_here
```

Keep your API key private and do not commit `.env.local` to the repository.

## 🔌 API

### Analyze Speech

```text
POST /api/analyze
```

Send an audio recording using the `audio` form-data field.

The API returns the transcript, confidence score, speaking characteristics, filler-word analysis, strengths, and improvement feedback.

### Health Check

```text
GET /api/analyze
```

Returns the current status of the analysis service.

## 📄 License

Proprietary. Internal use only.
