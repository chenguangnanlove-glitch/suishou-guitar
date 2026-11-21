/**
 * pwa.js — Service Worker 注册。
 *
 * 只做三件事：
 *   1. 在安全上下文里注册 sw.js，让站点离线可用、可「安装到应用列表」。
 *   2. 暴露安装能力（浏览器支持时）供将来加按钮，默认不弹任何提示。
 *   3. 更新交给 Service Worker 自己的 skipWaiting 处理：下次打开就是新版。
 *
 * 为什么刻意不做「有新版本，点此刷新」的提示条：
 * 弹唱过程中页面重载会中断声音和手势状态。让更新在下次打开时自然生效，
 * 比打断正在弹的人要好。
 */

const SW_URL = 'sw.js?v=1';

let registration = null;
let installEvent = null;

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

async function register() {
  if (!canUseOffline()) return;

  try {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: './' });
  } catch (error) {
    // 注册失败不该影响弹唱，静默记录即可。
    console.warn('[PWA] Service Worker 注册失败：', error?.message || error);
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  // 拦下浏览器默认的安装横幅，等用户自己决定。
  event.preventDefault();
  installEvent = event;
});

window.addEventListener('appinstalled', () => {
  installEvent = null;
});

register();

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
  async install() {
    if (!installEvent) return false;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    installEvent = null;
    return choice?.outcome === 'accepted';
  },
  async update() {
    await registration?.update();
  },
};
