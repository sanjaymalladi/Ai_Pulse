# 🎙️ AI News Studio

A powerful web-based AI news studio that revolutionizes content creation by aggregating RSS feeds, identifying viral news, generating video scripts via LLMs, and synthesizing ultra-realistic speech using a custom TTS engine.

## ✨ Features

- **📰 RSS & Content Aggregation**: Connects to major feeds to source trending stories in real-time.
- **🔥 Viral Content Identification**: Leverages intelligent heuristics and AI to filter high-potential stories.
- **📝 Automated Script Generation**: Employs LLMs to transform raw articles into engaging, native video scripts with perfect pacing.
- **🔊 Custom TTS Synthesis**: High-quality voiceovers driven by a dedicated TTS endpoint with real-time SSE (Server-Sent Events) audio synthesis to bypass browser timeouts and CORS limits.
- **⚡ Modern Frontend**: Sleek, fast user interface built with Next.js, Tailwind CSS, and React.

## 🚀 Getting Started

First, ensure you have your environment variables and backend TTS server running. Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the studio interface!

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: Tailwind CSS / Vanilla CSS
- **APIs**: Server-Sent Events (SSE), Fetch API
- **AI Integrations**: Custom LLM endpoints & internal TTS Engine

## 📦 Project Architecture

- `app/`: Next.js application routes and shared global UI.
- `components/`: Modular React components for the studio interface.
- `public/`: Static assets and media files.
