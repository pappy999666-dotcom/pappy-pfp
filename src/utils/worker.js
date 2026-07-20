/**
 * Soft async worker queue — limits concurrency so heavy downloads
 * never block other commands. Default max 2 concurrent tasks.
 */
class WorkerQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._tick();
    });
  }

  _tick() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      Promise.resolve()
        .then(() => fn())
        .then(result => { resolve(result); })
        .catch(err => { reject(err); })
        .finally(() => { this.running--; this._tick(); });
    }
  }

  get pending() { return this.queue.length; }
  get active()  { return this.running; }
}

// Shared singleton — all downloads share one queue (max 2 at once)
const downloadQueue = new WorkerQueue(2);
// AI image gen gets its own slot so it never stalls behind downloads
const imageQueue    = new WorkerQueue(2);

module.exports = { WorkerQueue, downloadQueue, imageQueue };
