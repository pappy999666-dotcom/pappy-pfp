'use strict';
/**
 * cache.js — Smart In-Memory Cache for PAPPY PFP V3
 *
 * Lightweight LRU-style TTL cache.
 * Used to cache wallpaper search results, API responses, and DB queries.
 * Auto-evicts expired entries on access and on a periodic sweep.
 */

const logger = require('./logger');

class Cache {
  constructor({ maxSize = 500, sweepIntervalMs = 5 * 60 * 1000 } = {}) {
    this._store       = new Map();
    this._maxSize     = maxSize;
    this._hits        = 0;
    this._misses      = 0;
    this._sweepTimer  = null;

    if (sweepIntervalMs > 0) {
      this._sweepTimer = setInterval(() => this._sweep(), sweepIntervalMs);
      if (this._sweepTimer?.unref) this._sweepTimer.unref();
    }
  }

  /** Store a value with a TTL in milliseconds. */
  set(key, value, ttlMs = 60_000) {
    if (this._store.size >= this._maxSize) {
      // Evict oldest entry
      const first = this._store.keys().next().value;
      this._store.delete(first);
    }
    this._store.set(String(key), { value, expiresAt: Date.now() + ttlMs });
  }

  /** Get a value (returns undefined if missing or expired). */
  get(key) {
    const entry = this._store.get(String(key));
    if (!entry) { this._misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(String(key));
      this._misses++;
      return undefined;
    }
    this._hits++;
    return entry.value;
  }

  /** Check existence without recording stats. */
  has(key) {
    const entry = this._store.get(String(key));
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { this._store.delete(String(key)); return false; }
    return true;
  }

  /** Delete a key. */
  delete(key) {
    this._store.delete(String(key));
  }

  /** Delete all keys matching a prefix. */
  deletePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }

  /** Flush entire cache. */
  flush() {
    this._store.clear();
  }

  /** Get or compute — runs factory only on cache miss. */
  async getOrSet(key, factory, ttlMs = 60_000) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const value = await factory();
    if (value !== undefined && value !== null) {
      this.set(key, value, ttlMs);
    }
    return value;
  }

  /** Stats snapshot. */
  stats() {
    return {
      size:   this._store.size,
      hits:   this._hits,
      misses: this._misses,
      ratio:  this._hits + this._misses > 0
        ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  /** Remove expired entries. */
  _sweep() {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) { this._store.delete(key); evicted++; }
    }
    if (evicted > 0) logger.debug(`Cache sweep: evicted ${evicted} expired entries`);
  }

  /** Destroy the cache and clear sweep timer. */
  destroy() {
    if (this._sweepTimer) clearInterval(this._sweepTimer);
    this._store.clear();
  }
}

// ── Shared singletons ─────────────────────────────────────────────────────────

/** 10-minute TTL for wallpaper search results */
const wallpaperCache = new Cache({ maxSize: 300, sweepIntervalMs: 5 * 60 * 1000 });

/** 5-minute TTL for Pinterest API calls */
const pinterestCache = new Cache({ maxSize: 200, sweepIntervalMs: 3 * 60 * 1000 });

/** 60-second TTL for DB count queries (stats panel) */
const statsCache = new Cache({ maxSize: 50, sweepIntervalMs: 60_000 });

/** General-purpose short-lived cache (1-minute default TTL) */
const generalCache = new Cache({ maxSize: 500 });

module.exports = { Cache, wallpaperCache, pinterestCache, statsCache, generalCache };
