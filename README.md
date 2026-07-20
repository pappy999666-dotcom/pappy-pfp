# PAPPY PFP V3

> Premium Telegram + WhatsApp automation bot with HD wallpaper drops, AI image generation, WhatsApp profile picture management, and a full owner control panel.

## Features

### Core
- 📱 **WhatsApp Pairing** — QR code or pairing code authentication for unlimited accounts
- 🖼 **Profile Pictures** — Upload HD photos with zero cropping, get/delete current PFP
- 🔄 **Auto-Change PFP** — Schedule automatic profile picture rotation (hourly or daily)
- 👥 **Group PFP** — Change WhatsApp group profile pictures immediately or on a daily schedule
- ✏️ **Display Name** — Change WhatsApp display name

### Content
- 🌄 **Daily Wallpaper Drops** — 50 curated HD categories, auto-dropped to Telegram and WhatsApp channels
- 🔍 **Pinterest Search** — Search and browse Pinterest images in-app
- 🎨 **AI Image Generator** — Generate images via OpenRouter (Flux, DALL-E 3, SD 3.5)
- 📥 **Media Downloader** — Download from TikTok, Instagram, Twitter/X, YouTube, Pinterest, Facebook, Reddit, Threads

### Premium
- ⸸ **Automatic Watermarking** — Configurable gothic signature on every wallpaper
- 🔬 **AI Enhancement** — Upscale, sharpen, and artifact-reduce images before sending
- 🛡 **Quality Filtering** — Reject thumbnails and compressed images automatically
- 🎫 **Support Tickets** — Built-in user support system with owner reply
- 📣 **Broadcast** — Send messages to all users from Telegram
- 👑 **Owner Settings Center** — Toggle every feature from Telegram (no .env editing)

## Setup

### Prerequisites
- Node.js 20+
- MongoDB (Atlas or self-hosted), optional — uses in-memory fallback
- Redis, optional — required for Auto-Change scheduler

### Installation

```bash
git clone https://github.com/pappy999666-dotcom/pappy-pfp.git
cd pappy-pfp
cp .env.example .env
# Edit .env with your BOT_TOKEN, OWNER_ID, and MONGODB_URI
npm install
npm start
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `OWNER_ID` | ✅ | Telegram user ID(s) of owner, comma-separated |
| `MONGODB_URI` | Recommended | MongoDB connection string |
| `REDIS_URL` | For auto-change | Redis connection string |
| `OWNER_WA_NUMBER` | For WA features | Owner's WhatsApp number |
| `OPENROUTER_API_KEY` | For /imagine | OpenRouter API key |
| `UNSPLASH_ACCESS_KEY` | Optional | Unsplash fallback for wallpapers |
| `PEXELS_API_KEY` | Optional | Pexels fallback for wallpapers |
| `SESSION_SECRET` | ✅ | AES-256-GCM key for session encryption |

See `.env.example` for full configuration reference.

## Commands

| Command | Description |
|---|---|
| `/start` | Open main menu |
| `/help` | Help and guide |
| `/imagine <prompt>` | Generate AI image |
| `/download <url>` | Download media |
| `/setname <name>` | Change WhatsApp display name |
| `/jid` | List WA group JIDs (owner only) |

## Wallpaper Categories (50)

anime, dark_anime, cute_anime, manhwa, manga, novel_art, girls, boys, fashion, streetwear, cyberpunk, gaming, sci_fi, technology, minimal, amoled, aesthetic, neon, abstract, vintage, minimalist, nature, mountains, ocean, sunset, forest, waterfall, flowers, rain, cars, architecture, city, night_city, fantasy, space, luxury, japanese, korean, mythology, dragons, magic, warriors, superheroes, horror, animals, sports, lofi, food, quotes, weekend_specials, monthly_collections

## Owner Settings Center

Access from: Owner Panel → ⚙️ Settings & Advanced

| Group | Controls |
|---|---|
| 🌄 Daily Drops | Enable/disable, auto-drop, images per drop, interval, stagger |
| ⸸ Watermark | Enable/disable, opacity, position, size, text, margin |
| 🔬 Enhancer | Enable upscale, sharpen, artifact reduction |
| 🛡 Rate Limits | Window duration, max requests per window |
| 🔧 Maintenance | Toggle maintenance mode, set custom message |
| 📋 Logging | Log level, debug mode |
| 📤 Uploads | Max images, max file size, max schedule days |
| ⏱ Cooldowns | Pairing timeout, group join cooldown, broadcast delay |
| ⏰ Scheduler | Auto-cleanup toggle, cleanup age |
| 💬 WA Channel | Channel publishing, auto-publish, retry config |
| 🗂 Categories | Toggle individual wallpaper categories on/off |

## Architecture

```
src/
├── app.js               — Bootstrap and entry point
├── commands/            — /start, /jid
├── config/
│   ├── index.js         — Environment config
│   └── settingsManager.js — Runtime persistent settings
├── database/
│   ├── connect.js       — MongoDB connection
│   └── models.js        — Mongoose schemas
├── handlers/            — Telegram interaction handlers
├── inline/              — Inline query handler
├── middleware/          — Session, auth, rate limiting
├── owner/               — Owner control panel
├── schedulers/          — BullMQ and interval schedulers
├── services/            — WhatsApp, wallpaper, AI, support
└── utils/
    ├── ui.js            — Premium UI formatting system
    ├── errorHandler.js  — Comprehensive error handling
    ├── watermark.js     — Automatic branding system
    ├── imageEnhancer.js — AI enhancement pipeline
    ├── cache.js         — Smart LRU TTL cache
    ├── qualityFilter.js — Wallpaper quality verification
    └── performanceMonitor.js — Memory/CPU monitoring
```

## Version

**V3.0.0** — Complete UI/UX, Performance & System Refactor  
See [CHANGELOG.md](CHANGELOG.md) for full details.
