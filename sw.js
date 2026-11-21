/*
 * 随手吉他 — 离线缓存。
 *
 * 这个文件由 tools/make-sw.py 生成，不要手改：
 *   CACHE_NAME 取所有预缓存文件的内容哈希，改任何文件都会自动失效旧缓存。
 *
 * 两个坑，都已经处理：
 *   1. Cloudflare Pages 把 /index.html 用 308 重定向到 /。
 *      预缓存里【不放 index.html】，只放 ./，避免存下带 redirected 标记的响应
 *      —— 那种响应不能用于满足导航请求，会表现为「刷新后页面打不开」。
 *   2. 站点请求资源时都带 ?v=N（app.js?v=20 等）。
 *      所以匹配缓存一律用 ignoreSearch: true，否则离线时全部落空。
 */

const CACHE_NAME = 'suishou-guitar-7b382fbdd8dc';
const SHELL_VERSION = '7b382fbdd8dc';

const APP_SHELL = [
  './',
  'manifest.webmanifest',
  'style.css',
  'pwa.js',
  'app.js',
  'audio.js',
  'choice-fields.js',
  'chords.js',
  'haptics.js',
  'input.js',
  'music.js',
  'rhythm-editor.js',
  'rhythm-model.js',
  'riff-editor.js',
  'riff-model.js',
  'sets-model.js',
  'synthesis.js',
  'voicing-model.js',
  'audio/CREDITS.txt',
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
  'audio/manifest.json',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
];

/* ---------------- 安装：预缓存全部资源 ---------------- */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 逐个 add 而不是 addAll：一个文件失败不该拖垮整份缓存。
    const results = await Promise.allSettled(
      APP_SHELL.map((url) => cache.add(
        // 显式解析成绝对地址：Request 构造器不接受 "./" 这类相对路径
        new Request(new URL(url, self.location.href).href, { cache: 'reload' }),
      )),
    );
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? APP_SHELL[i] : null))
      .filter(Boolean);
    if (failed.length) {
      console.warn('[SW] 这些资源没能缓存，离线时会缺：', failed);
    }
    // 新版本立即生效，不把用户卡在旧版本上。
    await self.skipWaiting();
  })());
});

/* ---------------- 激活：清掉旧版本缓存 ---------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

/* ---------------- 工具 ---------------- */

/** 统一缓存键：去掉 query，避免 ?v=20 和 ?v=21 各存一份。 */
function canonical(url) {
  const u = new URL(url);
  return new Request(u.origin + u.pathname);
}

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

/* ---------------- 导航请求：先用缓存的外壳 ---------------- */

async function navigationResponse(request) {
  const cached = await fromCache(request);
  if (cached && !cached.redirected) return cached;

  try {
    const response = await fetch(request);
    // 303/307/308 之类不写入缓存，交给浏览器自己处理跳转。
    if (response.ok && !response.redirected) {
      await putCache(request, response);
    }
    return response;
  } catch (error) {
    // 真离线且没有缓存：给一个能看懂的页面，而不是浏览器默认的错误页。
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
  small{font-size:12px;color:#8b9791;display:block;margin-top:18px}
</style></head><body><div>
  <h1>还没有缓存好</h1>
  <p>请联网打开一次「随手吉他」，之后就能完全离线弹唱。</p>
  <small>如果一直这样，检查一下网络，然后刷新。</small>
</div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/* ---------------- 其它请求：缓存优先，网络兜底 ---------------- */

async function cacheFirst(request) {
  const cached = await fromCache(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await putCache(request, response);
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

/* ---------------- 与页面通信 ---------------- */

self.addEventListener('message', (event) => {
  if (event.data?.type === 'VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: SHELL_VERSION });
  }
});
