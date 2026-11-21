/**
 * pwa.js — Service Worker 注册、后台预热与安装引导。
 *
 * 三件事，顺序很重要：
 *   1. 尽早捕获 beforeinstallprompt，把它变成设置面板里的「安装到桌面」按钮。
 *   2. 注册 Service Worker。它只预缓存核心文件（js/css/图标，约 150 KB），几秒完成。
 *   3. 等它就绪后，让它在后台慢慢缓存 27 个音频采样（约 710 KB）。
 *
 * 为什么音频不在 install 里一起缓存：
 * 慢网络上 53 个文件并发要 20 秒以上，其中任何一个请求挂起，
 * install 就永远完不成，Service Worker 会卡在 installing 状态永不接管页面
 * —— 表现为「断网打不开」而且「每次打开都重新下载，越用越慢」。
 *
 * 为什么要预热音频：
 * 不预热的话，第一次断网时 27 个采样一个都没有，弹唱按下去没有声音。
 * 预热是后台做的，不阻塞页面任何操作。
 */

const SW_URL = 'sw.js';
const WARM_DELAY = 1500;      // 先让首屏稳定下来再开始拉音频
const HINT_KEY = 'suishou.installHintSnoozed';

let registration = null;
let installEvent = null;
let warmed = false;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * 离线能力需要安全上下文。
 * HTTPS、localhost、127.0.0.1 之外（比如手机通过局域网 http://192.168.x.x 访问）
 * 浏览器会直接拒绝注册 Service Worker。
 */
export function canUseOffline() {
  if (!('serviceWorker' in navigator)) return false;
  if (typeof isSecureContext === 'boolean') return isSecureContext;
  return location.protocol === 'https:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';
}

export function isOfflineReady() {
  return Boolean(navigator.serviceWorker?.controller);
}

// ============================================================
//  平台判断
// ============================================================

function isIOS() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ 伪装成 Mac，靠触摸点数区分
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}

/** 安卓上的国产浏览器大多不实现 beforeinstallprompt，只能给菜单指引。 */
function browserName() {
  const ua = navigator.userAgent || '';
  if (/EdgA?\//.test(ua)) return 'Edge';
  if (/MicroMessenger/i.test(ua)) return '微信';
  if (/QQ\//.test(ua)) return 'QQ';
  if (/UCBrowser/i.test(ua)) return 'UC';
  if (/MiuiBrowser/i.test(ua)) return '小米浏览器';
  if (/HuaweiBrowser/i.test(ua)) return '华为浏览器';
  if (/HeyTapBrowser|OppoBrowser/i.test(ua)) return 'OPPO 浏览器';
  if (/VivoBrowser/i.test(ua)) return 'vivo 浏览器';
  if (/SamsungBrowser/i.test(ua)) return '三星浏览器';
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '';
}

// ============================================================
//  安装界面
// ============================================================

function el(id) {
  return document.getElementById(id);
}

function setStatus(text, tone = '') {
  const node = el('installStatus');
  if (!node) return;
  node.textContent = text || '';
  node.className = 'install-status' + (tone ? ' ' + tone : '');
}

function setSteps(html) {
  const node = el('installSteps');
  if (!node) return;
  if (html) {
    node.innerHTML = html;
    node.hidden = false;
  } else {
    node.innerHTML = '';
    node.hidden = true;
  }
}

/** 根据当前能力刷新设置面板里的安装区块。任何时刻调用都安全。 */
function renderInstallUI() {
  const section = el('installSection');
  const action = el('installApp');
  const intro = el('installIntro');
  const badge = el('installBadge');
  if (!section || !action || !intro) return;

  // 1) 已经是独立窗口打开 —— 装好了
  if (isStandalone()) {
    badge.textContent = '已安装';
    intro.textContent = '当前就是从桌面图标打开的，已经是独立 App 的样子。';
    action.hidden = true;
    setSteps('');
    setStatus('想再装一份？删掉桌面图标后重新打开网页安装即可。');
    return;
  }

  // 2) Chrome 认可可安装 —— 给真正的按钮
  if (installEvent) {
    badge.textContent = '推荐';
    intro.textContent = '装到桌面后像 App 一样全屏打开，界面没有地址栏，断网也能弹。';
    action.hidden = false;
    setSteps('');
    setStatus('');
    return;
  }

  // 3) iPhone / iPad —— 只能走 Safari 的分享菜单
  if (isIOS()) {
    badge.textContent = '可选';
    intro.textContent = 'iPhone 上需要两步添加到桌面。';
    action.hidden = true;
    setSteps(
      '用 <b>Safari</b> 打开本页 → 点底部中间的 <b>分享</b> 按钮 → 向下找到 <b>添加到主屏幕</b> → 点「添加」'
      + '<br>注意：Chrome、微信里打开没有这个选项。'
    );
    setStatus('添加后从桌面图标打开，就是全屏的样子。');
    return;
  }

  // 4) 安卓但当前浏览器不支持一键安装 —— 给菜单路径
  const name = browserName();
  badge.textContent = '可选';
  if (name === '微信' || name === 'QQ') {
    intro.textContent = '当前在聊天软件里打开，无法安装。';
    action.hidden = true;
    setSteps('点右上角 <b>···</b> → 选择 <b>在浏览器中打开</b> → 再用 Chrome 打开本页。');
    setStatus('');
    return;
  }

  intro.textContent = '当前浏览器不提供一键安装，用菜单也可以添加。';
  action.hidden = true;
  if (isAndroid()) {
    setSteps(
      '点右上角 <b>⋮</b> 菜单 → 选 <b>安装应用</b>'
      + '<br>如果没有这一项，找 <b>添加到主屏幕</b> 也是一样的效果。'
      + '<br>推荐用 <b>Chrome</b> 打开，安装入口最稳定。'
    );
  } else {
    setSteps(
      '电脑上：点地址栏右侧的 <b>安装</b> 图标，或菜单里的 <b>安装随手吉他</b>。'
      + '<br>手机上请用 Chrome 打开。'
    );
  }
  setStatus('');
}

/** 可安装事件到了：记录起来，并刷新界面。 */
function onBeforeInstallPrompt(event) {
  event.preventDefault();
  installEvent = event;
  renderInstallUI();
}

window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

window.addEventListener('appinstalled', () => {
  installEvent = null;
  renderInstallUI();
  setStatus('已添加到桌面。下次请从桌面图标打开。', 'ok');
});

async function doInstall() {
  if (!installEvent) {
    renderInstallUI();
    return;
  }
  const action = el('installApp');
  if (action) action.disabled = true;
  try {
    installEvent.prompt();
    // 有些浏览器（尤其国产壳）在 prompt 之后不 resolve userChoice，
    // 不给超时的话这里会一直挂着，用户什么都看不到。
    const choice = await Promise.race([
      installEvent.userChoice,
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (choice === null) {
      setStatus('安装对话框已打开。按提示确认即可，装好后桌面会出现「随手吉他」。', 'ok');
    } else if (choice.outcome === 'accepted') {
      setStatus('正在安装…完成后桌面会出现「随手吉他」。', 'ok');
    } else {
      setStatus('这次取消了。想装的时候再点一次。');
    }
  } catch (error) {
    setStatus('安装没能开始，试试浏览器菜单里的「安装应用」。', 'warn');
  } finally {
    installEvent = null;
    if (action) action.disabled = false;
    renderInstallUI();
  }
}

// ============================================================
//  Service Worker 与音频预热
// ============================================================

/** 让 Service Worker 在后台把音频补进缓存。只会触发一次。 */
function warmAudio() {
  if (warmed) return;
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;
  warmed = true;
  // 延迟一点：避开首屏渲染和采样解码的高峰
  setTimeout(() => {
    try {
      sw.postMessage({ type: 'WARM_AUDIO' });
    } catch (error) {
      warmed = false;
    }
  }, WARM_DELAY);
}

async function register() {
  if (!canUseOffline()) return;

  try {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: './' });

    // 已经接管（老用户升级）：直接预热
    if (navigator.serviceWorker.controller) {
      warmAudio();
    }

    // 首次安装：等 controller 生效后再预热
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      warmAudio();
    });

    await navigator.serviceWorker.ready;
  } catch (error) {
    // 注册失败不该影响弹唱，静默记录即可。
    console.warn('[PWA] Service Worker 注册失败：', error?.message || error);
  }
}

// ============================================================
//  启动
// ============================================================

function boot() {
  // 绑安装按钮
  const action = el('installApp');
  if (action) action.addEventListener('click', doInstall);

  renderInstallUI();

  // 页面完全加载后再注册，不和采样下载抢带宽
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

/** 调试与将来扩展用：window.__suishouPWA.install() 可手动触发安装。 */
window.__suishouPWA = {
  get ready() {
    return isOfflineReady();
  },
  get standalone() {
    return isStandalone();
  },
  get canInstall() {
    return Boolean(installEvent);
  },
  /** 让设置面板重新判断一次（调试用） */
  refresh() {
    renderInstallUI();
  },
  async install() {
    if (!installEvent) return false;
    await doInstall();
    return true;
  },
  async update() {
    await registration?.update();
  },
  warmAudio() {
    warmed = false;
    warmAudio();
  },
  /** 报告缓存现状，排查「为什么离线没声音」用 */
  async cacheStatus() {
    const names = await caches.keys();
    if (!names.length) return { caches: [], files: 0, mp3: 0 };
    const cache = await caches.open(names[0]);
    const keys = await cache.keys();
    const paths = keys.map((k) => new URL(k.url).pathname);
    const bad = [];
    for (const k of keys) {
      const p = new URL(k.url).pathname;
      if (!/\.(html?)$/.test(p) && p !== '/') {
        const res = await cache.match(k);
        const ct = (res?.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) bad.push(p);
      }
    }
    return {
      caches: names,
      files: keys.length,
      mp3: paths.filter((p) => p.endsWith('.mp3')).length,
      badTypes: bad,
    };
  },
};
