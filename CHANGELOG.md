# PAPPY PFP — Changelog

## V3.0.0 — Complete UI/UX, Performance & System Refactor

### New Files Added
- `src/utils/ui.js` — Premium UI formatting system (blockquotes, templates, stat rows)
- `src/utils/errorHandler.js` — Comprehensive error handler (30+ error types, friendly messages, error IDs)
- `src/utils/watermark.js` — Automatic gothic branding / watermark system (configurable via Owner Settings)
- `src/utils/imageEnhancer.js` — AI image enhancement pipeline (upscale, sharpen, artifact reduction)
- `src/utils/cache.js` — Smart LRU TTL cache (wallpaper, Pinterest, stats, general)
- `src/utils/performanceMonitor.js` — Lightweight memory/CPU monitor
- `src/utils/qualityFilter.js` — Wallpaper URL quality scoring and dimension verification
- `src/config/settingsManager.js` — Persistent runtime settings (all features configurable from Telegram)
- `src/handlers/ownerSettingsHandler.js` — Full Owner Settings Center (11 feature groups)

### Rewritten Files
- `src/app.js` — Clean boot sequence, graceful shutdown, maintenance middleware, performance monitoring
- `src/commands/start.js` — Premium blockquote welcome message with feature list
- `src/handlers/keyboards.js` — 50 wallpaper categories, new settings keyboards, consistent button colors
- `src/handlers/callbackRouter.js` — Full o_settings routing, error handler integration, maintenance gate
- `src/handlers/messageRouter.js` — Settings input routing, maintenance gate
- `src/handlers/accountHandler.js` — Premium UI for all account management flows
- `src/handlers/pairingHandler.js` — Premium pairing code display (blockquote box)
- `src/handlers/wallpaperHandler.js` — Premium gallery with emojis, captions, pagination
- `src/handlers/imageGenHandler.js` — Queue position, model attribution, premium captions
- `src/handlers/downloadHandler.js` — Premium download UI with platform icons
- `src/handlers/supportHandler.js` — Premium ticket system with ticket headers
- `src/handlers/groupPfpHandler.js` — Premium group PFP flow with live progress
- `src/handlers/pinterestHandler.js` — Premium Pinterest gallery
- `src/owner/ownerHandler.js` — Premium owner panel with stats, Settings Center link
- `src/services/wallpaper.js` — 50 categories, quality filtering, enhancement pipeline, watermark integration
- `src/schedulers/wallpaperScheduler.js` — Settings-aware, dynamic reload, clear logging
- `src/middleware/rateLimit.js` — Settings-aware rate limiting, auto-sweep memory cleanup
- `src/middleware/auth.js` — Standard Telegraf middleware pattern
- `src/utils/storage.js` — Streaming downloads, deleteOldFiles helper

### UI/UX Changes
- Every message uses rich blockquotes for structured information
- Loading states before all async operations
- No raw errors or stack traces ever reach users
- Every error has an ID, friendly message, fix suggestion, and retry button
- Premium captions for wallpaper drops with hashtags, metadata, and attribution
- Gothic watermark system (⸸ PAPPY) — configurable opacity, position, size, text
- Consistent button colors: Primary (blue), Success (green), Danger (red)

### Performance Changes
- Image enhancement pipeline (Lanczos upscale, unsharp mask, mozjpeg re-encode)
- LRU TTL cache for search results (10-min wallpaper cache, 5-min Pinterest cache)
- Streaming file downloads instead of full-buffer arraybuffer
- Rate limiter auto-sweeps stale entries every 5 minutes
- Performance monitor logs RSS/heap/CPU every 30 minutes

### Feature Additions
- **50 wallpaper categories** (up from 40): added dark_anime, cute_anime, manhwa, amoled, streetwear, technology, rain, luxury, japanese, korean, night_city
- **Manhwa** category targets stylish/fashionable/charismatic character aesthetic
- **Owner Settings Center** — all features toggleable from Telegram without touching .env
- **Automatic watermarking** — gothic signature on every wallpaper (owner-configurable)
- **Quality filtering** — rejects thumbnails and sub-800×1000 images before posting
- **Duplicate prevention** — wallpapers not re-posted if already sent
- **Maintenance mode** — owner can toggle bot offline from Telegram instantly

---

## V2.2.0 — Previous version
See git history for V2.x changes.
