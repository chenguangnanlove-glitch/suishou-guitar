/*
 * 随手吉他 — 离线缓存。
 *
 * 这个文件由 tools/make-sw.py 生成，不要手改。
 *
 * 三个坑，都已经处理：
 *   1. Cloudflare Pages 把 /index.html 用 308 重定向到 /。
 *      预缓存里【不放 index.html】，只放 ./，避免存下带 redirected 标记的响应
 *      —— 那种响应不能用于满足导航请求，会表现为「刷新后页面打不开」。
 *   2. 站点请求资源时都带 ?v=N（app.js?v=20 等）。
 *      所有缓存匹配一律 ignoreSearch，否则离线时全部落空。
 *   3. 首次安装不能阻塞式下载全部音频。
 *      慢网络上 53 个文件并发要 20 秒以上，任何一个请求挂起，
 *      install 就永远完不成，SW 卡在 installing、永不接管页面。
 *      所以 install 只等核心文件；音频由页面调用 WARM_AUDIO 在后台补齐。
 */

const CACHE_NAME = 'suishou-guitar-c531e194084d';
const SHELL_VERSION = 'c531e194084d';

/* 核心文件：install 必须拿到的（约 170 KB） */
const CORE_SHELL = [
  './',
  'manifest.webmanifest',
  'style.css',
  'app.js',
  'audio.js',
  'choice-fields.js',
  'chords.js',
  'haptics.js',
  'input.js',
  'music.js',
  'pwa.js',
  'rhythm-editor.js',
  'rhythm-model.js',
  'riff-editor.js',
  'riff-model.js',
  'sets-model.js',
  'synthesis.js',
  'voicing-model.js',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
];

/* 音频与其余资源：就绪后后台预热（约 710 KB） */
const MEDIA_SHELL = [
  'audio/clean-A2.mp3',
  'audio/clean-A3.mp3',
  'audio/clean-As2.mp3',
  'audio/clean-As3.mp3',
  'audio/clean-B2.mp3',
  'audio/clean-B3.mp3',
  'audio/clean-C3.mp3',
  'audio/clean-C4.mp3',
  'audio/clean-Cs3.mp3',
  'audio/clean-Cs4.mp3',
  'audio/clean-D3.mp3',
  'audio/clean-D4.mp3',
  'audio/clean-Ds3.mp3',
  'audio/clean-E2.mp3',
  'audio/clean-E3.mp3',
  'audio/clean-E4.mp3',
  'audio/clean-F2.mp3',
  'audio/clean-F3.mp3',
  'audio/clean-F4.mp3',
  'audio/clean-Fs2.mp3',
  'audio/clean-Fs3.mp3',
  'audio/clean-Fs4.mp3',
  'audio/clean-G2.mp3',
  'audio/clean-G3.mp3',
  'audio/clean-G4.mp3',
  'audio/clean-Gs2.mp3',
  'audio/clean-Gs3.mp3',
  'audio/CREDITS.txt',
  'audio/manifest.json',
  'icon.svg',
];

const REQUEST_TIMEOUT = 15000;   // 单个请求硬超时
const BATCH_SIZE = 4;            // 分批并发，避免打爆慢网络

/* ---------------- 工具 ---------------- */

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** 统一缓存键：去掉 query，避免 ?v=20 和 ?v=21 各存一份。 */
function canonical(url) {
  const u = new URL(url);
  return u.origin + u.pathname;
}

async function cacheOne(cache, url) {
  const abs = new URL(url, self.location.href).href;
  const res = await withTimeout(
    fetch(new Request(abs, { cache: 'reload' })),
    REQUEST_TIMEOUT, url,
  );
  if (!res || !res.ok) throw new Error(`HTTP ${res && res.status}: ${url}`);

  // 站点对不存在的文件会回退返回首页 HTML。
  // 如果我们要的是 js/css/图片/音频，却拿到 text/html，说明这个文件根本没部署。
  // 绝不能把它当资源缓存 —— 否则离线时脚本会拿到一段 HTML 而报语法错误。
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const wantsNonHtml = !/\.(html?)$/i.test(url) && url !== './';
  if (wantsNonHtml && ct.includes('text/html')) {
    throw new Error(`期望资源却返回 HTML（文件不存在？）: ${url}`);
  }

  await cache.put(canonical(abs), res.clone());
}

/** 分批并发缓存，单个失败只记录不中断。 */
async function cacheBatch(cache, urls, label) {
  const failed = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const slice = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      slice.map((u) => cacheOne(cache, u)),
    );
    results.forEach((r, j) => {
      if (r.status === 'rejected') failed.push(`${slice[j]} (${r.reason.message})`);
    });
  }
  if (failed.length) {
    console.warn(`[SW] ${label} 有 ${failed.length} 个没缓存成功：`, failed);
  }
  return failed;
}

/* ---------------- 安装：只等核心文件 ---------------- */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cacheBatch(cache, CORE_SHELL, '核心文件');
    // 立即生效，不把用户卡在旧版本上。
    await self.skipWaiting();
  })());
});

/* ---------------- 激活：清旧缓存 ---------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

/* ---------------- 后台预热音频 ---------------- */

let warming = null;

async function warmMedia() {
  if (warming) return warming;
  warming = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const already = await cache.keys();
    const have = new Set(already.map((k) => new URL(k.url).pathname));
    const todo = MEDIA_SHELL.filter((u) => !have.has(new URL(u, self.location.href).pathname));
    if (!todo.length) return;
    await cacheBatch(cache, todo, '音频');
  })().finally(() => { warming = null; });
  return warming;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'WARM_AUDIO') {
    // 后台预热，不阻塞页面的任何操作
    event.waitUntil(warmMedia());
    return;
  }
  if (data.type === 'VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: SHELL_VERSION });
  }
});

/* ---------------- 取缓存 ---------------- */

async function fromCache(request) {
  return caches.match(request, { ignoreSearch: true });
}

async function putCache(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(canonical(request.url), response.clone());
  } catch (error) {
    // 配额满或响应不可缓存，忽略：下次联网再取。
  }
}

/* ---------------- 导航请求 ---------------- */

async function navigationResponse(request) {
  const cached = await fromCache(request);
  if (cached && !cached.redirected) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      await putCache(request, response);
    }
    return response;
  } catch (error) {
    return new Response(
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>随手吉他 · 暂时离线</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;
    background:#f8fafd;color:#202124;
    font-family:Roboto,'Noto Sans',system-ui,sans-serif;padding:24px;text-align:center}
  h1{font-size:20px;font-weight:600;margin:0 0 12px}
  p{font-size:14px;line-height:1.8;color:#667168;margin:0 0 8px}
  button{margin-top:18px;min-height:48px;padding:13px 26px;border:0;border-radius:26px;
    background:#146c42;color:#fff;font-size:15px;font-family:inherit}
  small{font-size:12px;color:#8b9791;display:block;margin-top:18px}
</style></head><body><div>
  <h1>还没有缓存好</h1>
  <p>请联网打开一次「随手吉他」，之后就能完全离线弹唱。</p>
  <button onclick="location.reload()">重新加载</button>
  <small>如果一直这样，检查一下网络。</small>
</div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/* ---------------- 其它请求：缓存优先 ---------------- */

async function cacheFirst(request) {
  const cached = await fromCache(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      const wantsNonHtml = !/\.(html?)$/i.test(new URL(request.url).pathname);
      // 别把 SPA 回退的 HTML 当成 js/css/图片缓存下来
      if (!(wantsNonHtml && ct.includes('text/html'))) {
        await putCache(request, response);
      }
    }
    return response;
  } catch (error) {
    return new Response('离线状态下这个资源还没缓存。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/* ---------------- 路由 ---------------- */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
