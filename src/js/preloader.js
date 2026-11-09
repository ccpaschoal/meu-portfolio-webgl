import { DefaultLoadingManager, ImageLoader } from 'three';

export function preloadAssets(urls) {
  const manager = DefaultLoadingManager;
  const assets = new Map();
  const failures = [];
  const progress = document.querySelector('#load-progress');
  const bar = progress.querySelector('span');
  const status = document.querySelector('#load-status');
  const previous = { onLoad: manager.onLoad, onProgress: manager.onProgress, onError: manager.onError };
  let disposed = false;
  const restore = () => {
    if (disposed) return;
    Object.assign(manager, previous);
    disposed = true;
  };
  const ready = new Promise((resolve) => {
    manager.onProgress = (url, loaded, total) => {
      const percentage = Math.round(loaded / total * 100);
      progress.setAttribute('aria-valuenow', String(percentage));
      bar.style.transform = `scaleX(${loaded / total})`;
      status.textContent = `Preparando a sessão… ${percentage}%`;
      previous.onProgress?.(url, loaded, total);
    };
    manager.onError = (url) => { failures.push(url); previous.onError?.(url); };
    manager.onLoad = () => {
      progress.setAttribute('aria-valuenow', '100');
      bar.style.transform = 'scaleX(1)';
      status.textContent = failures.length ? 'Algumas imagens não carregaram. Você pode tentar novamente.' : 'Tudo pronto. A sessão é sua.';
      document.querySelector('#retry-load').hidden = failures.length === 0;
      document.querySelector('#play-button').disabled = false;
      document.querySelector('#play-button').classList.add('is-ready');
      previous.onLoad?.();
      restore();
      resolve({ assets, failures });
    };
    // Keep a tracked font item open while all image requests are registered.
    manager.itemStart('portfolio-font');
    const loader = new ImageLoader(manager);
    [...new Set(urls)].forEach((url) => {
      loader.load(url, (image) => assets.set(url, image), undefined, () => assets.set(url, null));
    });
    const fonts = document.fonts?.load('500 16px Montserrat') ?? Promise.resolve();
    Promise.resolve(fonts).catch(() => manager.itemError('portfolio-font')).finally(() => manager.itemEnd('portfolio-font'));
  });
  return { ready, dispose: restore };
}
