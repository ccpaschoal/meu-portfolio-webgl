import { DefaultLoadingManager, ImageLoader } from 'three';

/** Track all portfolio image requests and keep the analog PLAY control locked until ready. */
export function preloadAssets(urls = []) {
  const manager = DefaultLoadingManager;
  const assets = new Map();
  const failures = [];
  const progress = document.querySelector('#load-progress');
  const bar = progress?.querySelector('span');
  const status = document.querySelector('#load-status');
  const retry = document.querySelector('#retry-load');
  const playButton = document.querySelector('#play-button');
  const previous = { onLoad: manager.onLoad, onProgress: manager.onProgress, onError: manager.onError };
  let disposed = false;
  let settled = false;
  let started = 0;

  if (playButton) {
    playButton.disabled = true;
    playButton.textContent = '▶ PLAY';
    playButton.setAttribute('aria-label', 'Aguarde o carregamento da sessão');
  }

  const restore = () => {
    if (disposed) return;
    // Do not overwrite handlers installed by another consumer after this loader.
    if (manager.onLoad === onLoad) manager.onLoad = previous.onLoad;
    if (manager.onProgress === onProgress) manager.onProgress = previous.onProgress;
    if (manager.onError === onError) manager.onError = previous.onError;
    disposed = true;
  };

  const onProgress = (url, loaded, total) => {
    const ratio = total > 0 ? loaded / total : 1;
    const percentage = Math.round(ratio * 100);
    progress?.setAttribute('aria-valuenow', String(percentage));
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (status) status.textContent = `Preparando a sessão… ${percentage}%`;
    previous.onProgress?.(url, loaded, total);
  };

  const onError = (url) => {
    if (!failures.includes(url)) failures.push(url);
    previous.onError?.(url);
  };

  const onLoad = () => {
    if (settled) return;
    settled = true;
    progress?.setAttribute('aria-valuenow', '100');
    if (bar) bar.style.transform = 'scaleX(1)';
    if (status) status.textContent = failures.length
      ? 'Algumas imagens não carregaram. Você ainda pode iniciar a sessão.'
      : 'Tudo pronto. A sessão é sua.';
    if (retry) retry.hidden = failures.length === 0;
    if (playButton) {
      playButton.disabled = false;
      playButton.classList.add('is-ready');
      playButton.setAttribute('aria-label', 'Iniciar o portfólio');
    }
    previous.onLoad?.();
    restore();
    resolveReady({ assets, failures });
  };

  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  manager.onLoad = onLoad;
  manager.onProgress = onProgress;
  manager.onError = onError;

  // Keep a tracked item open while requests and the web font are registered.
  manager.itemStart('portfolio-session-fonts');
  started += 1;
  const loader = new ImageLoader(manager);
  [...new Set(urls.filter((url) => typeof url === 'string' && url.length > 0))].forEach((url) => {
    loader.load(
      url,
      (image) => assets.set(url, image),
      undefined,
      () => { assets.set(url, null); },
    );
    started += 1;
  });
  const fontLoad = document.fonts?.load('500 16px Montserrat') ?? Promise.resolve();
  Promise.resolve(fontLoad)
    .catch(() => { failures.push('portfolio-session-fonts'); })
    .finally(() => manager.itemEnd('portfolio-session-fonts'));

  // The manager dispatches onLoad after the final itemEnd; this guard handles an empty URL set.
  if (started === 1 && manager.itemsLoaded === manager.itemsTotal) queueMicrotask(onLoad);
  return { ready, dispose: restore };
}
