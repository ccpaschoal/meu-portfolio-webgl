import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PortfolioScene } from '../scene.js';
import type { PortfolioSceneInstance } from '../types/portfolio';

export interface WebGLCanvasProps {
  onChapterChange?: (chapter: number) => void;
  onProgressChange?: (progress: number) => void;
  onTeaserTriggered?: () => void;
  onTeaserReturn?: () => void;
  onSiteChange?: (siteIndex: number) => void;
}

/**
 * WebGLCanvas Component
 * Encapsula a cena Three.js dentro do ciclo de vida do React.
 * Garante tipagem estrita de refs e execução completa de .dispose() no unmount.
 */
export const WebGLCanvas: React.FC<WebGLCanvasProps> = ({
  onChapterChange,
  onProgressChange,
  onTeaserTriggered,
  onTeaserReturn,
  onSiteChange
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PortfolioSceneInstance | null>(null);

  const onChapterChangeRef = useRef(onChapterChange);
  onChapterChangeRef.current = onChapterChange;

  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;

  const onTeaserTriggeredRef = useRef(onTeaserTriggered);
  onTeaserTriggeredRef.current = onTeaserTriggered;

  const onTeaserReturnRef = useRef(onTeaserReturn);
  onTeaserReturnRef.current = onTeaserReturn;

  const onSiteChangeRef = useRef(onSiteChange);
  onSiteChangeRef.current = onSiteChange;

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Inicializa a cena Three.js
    const app = new PortfolioScene(containerRef.current) as unknown as PortfolioSceneInstance;
    appRef.current = app;
    window.portfolioApp = app;

    let targetProgress = 0.0;
    let currentProgress = 0.0;
    let lastChapter = 0;
    let hasTriggered = false;
    let animFrameId: number | null = null;

    const SCROLL_FACTOR = 0.00028;
    // Na espiral a rolagem anda mais devagar para dar para ver cada lâmina (~1,5 lâmina por clique)
    const scrollSpeedAt = (p: number) => {
      const stops = spiralStops();
      return p >= stops[0] - 0.01 && p <= stops[stops.length - 1] + 0.01 ? 0.6 : 1;
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const curtainEl = curtainRef.current;

    let snapTimeout: ReturnType<typeof setTimeout> | null = null;
    let snapTween: gsap.core.Tween | null = null;
    let lastScrollDelta = 0;
    let lastWheelAt = 0;

    // Platôs e começo de cada ato no tempo da master timeline (0–100s)
    const PHONE_PLATEAU = 0.35;
    const CONTACT_PLATEAU = 0.90;
    const CHAPTER_STARTS = [0, 24, 46, 73];
    const chapterAt = (time: number) => {
      let chapter = 0;
      for (let i = 1; i < CHAPTER_STARTS.length; i++) if (time >= CHAPTER_STARTS[i]) chapter = i;
      return chapter;
    };
    const spiralStops = () => app.spiralStops?.length ? app.spiralStops : [0.49, 0.71];

    // Para onde a rolagem assenta quando a pessoa para de rolar
    const calculateSnapTarget = (p: number, dir: number) => {
      const stops = spiralStops();
      const first = stops[0];
      const last = stops[stops.length - 1];
      // Ato 00 — Matriz / Polaroids: platô 0.00
      if (p < 0.18) {
        if (dir > 0 && p > 0.10) return PHONE_PLATEAU;
        return 0.00;
      }
      // Ato 01 — Digital / 4 celulares: platô 0.35
      if (p < first - 0.025) {
        if (dir > 0 && p > 0.40) return first;
        if (dir < 0 && p < 0.26) return 0.00;
        return PHONE_PLATEAU;
      }
      // Ato 02 — Espiral: assenta na lâmina mais próxima (não volta para o meio)
      if (p <= last + 0.015) {
        if (dir < 0 && p < first - 0.01) return PHONE_PLATEAU;
        let nearest = first;
        for (const stop of stops) if (Math.abs(stop - p) < Math.abs(nearest - p)) nearest = stop;
        return nearest;
      }
      // Ato 03 — Contato / browsers: platô 0.90
      if (dir < 0 && p < 0.80) return last;
      return CONTACT_PLATEAU;
    };

    // Celulares (platô 0.35): cada gesto de rodinha/trackpad/toque troca no máximo um site.
    // O gesto que chega de outro ato só assenta nos celulares; no último site, um gesto novo segue a narrativa.
    let phoneGestureLocked = false;
    let phoneGestureFromOutside = false;
    let phoneAccum = 0;
    const consumePhoneGesture = (delta: number, newGesture: boolean, threshold: number) => {
      if (newGesture) {
        phoneGestureLocked = false;
        phoneGestureFromOutside = false;
        phoneAccum = 0;
      }
      if (Math.abs(targetProgress - PHONE_PLATEAU) >= 0.03) {
        phoneGestureFromOutside = true;
        return false;
      }
      if (phoneGestureFromOutside) phoneGestureLocked = true;

      const dir = delta > 0 ? 1 : -1;
      if (Math.sign(phoneAccum) !== dir) phoneAccum = 0;
      const busy = phoneGestureLocked;
      const site = app.getCurrentSiteIndex ? app.getCurrentSiteIndex() : (app.activeSiteIndex ?? 0);
      const total = app.phonesList?.length ?? 4;
      const canMove = dir > 0 ? site < total - 1 : site > 0;
      if (!busy && !canMove) return false;

      if (!busy) {
        phoneAccum += delta;
        if (Math.abs(phoneAccum) >= threshold) {
          phoneAccum = 0;
          phoneGestureLocked = true;
          app.showSite?.(dir);
        }
      }
      targetProgress = PHONE_PLATEAU;
      return true;
    };

    const scheduleSnap = () => {
      if (snapTimeout) clearTimeout(snapTimeout);
      if (reducedMotion.matches) return;

      snapTimeout = setTimeout(() => {
        if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;

        const destination = calculateSnapTarget(targetProgress, Math.sign(lastScrollDelta));
        if (Math.abs(targetProgress - destination) < 0.0005) return;

        snapTween?.kill();
        const state = { p: targetProgress };
        snapTween = gsap.to(state, {
          p: destination,
          // ajuste curto (lâmina vizinha) é rápido; troca de ato mantém o ritmo de antes
          duration: Math.min(0.85, 0.3 + Math.abs(destination - targetProgress) * 6),
          ease: 'power2.out',
          onUpdate: () => {
            targetProgress = state.p;
          },
          onComplete: () => {
            targetProgress = destination;
            snapTween = null;
          }
        });
      }, 760);
    };

    app.setProgress = (p: number) => {
      if (snapTimeout) clearTimeout(snapTimeout);
      snapTween?.kill();
      snapTween = null;
      targetProgress = Math.max(0.0, Math.min(1.0, p));
      currentProgress = targetProgress;
      if (app.masterTimeline) {
        app.masterTimeline.progress(targetProgress);
      }
    };

    const startPortfolio = () => {
      if (hasTriggered || app.isTransitioning) return;
      hasTriggered = true;
      document.body.classList.remove('is-teaser');
      app.triggerTeaserReveal();
      onTeaserTriggeredRef.current?.();
    };

    const returnToTeaser = () => {
      if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;
      if (snapTimeout) clearTimeout(snapTimeout);
      snapTween?.kill();
      snapTween = null;
      app.hideToTeaser(() => {
        document.body.classList.add('is-teaser');
        hasTriggered = false;
        targetProgress = 0.0;
        currentProgress = 0.0;
        if (app.masterTimeline) {
          app.masterTimeline.pause(0);
        }
        onTeaserReturnRef.current?.();
        onChapterChangeRef.current?.(0);
      });
    };

    // Callback de troca de site nos smartphones 3D — a cena chama (site, índice, total)
    app.onSiteChange = (_site, idx) => {
      onSiteChangeRef.current?.(idx);
    };

    // Navegação pelo tracker/teclado em andamento: a rolagem manual assume o controle
    const cancelNavTween = () => {
      if (!app.navTween?.isActive()) return;
      app.navTween.kill();
      app.navTween = null;
      if (curtainEl) curtainEl.style.opacity = '0';
      currentProgress = app.masterTimeline?.progress() ?? currentProgress;
      targetProgress = currentProgress;
    };

    // Eventos do mouse e ponteiro
    const handlePointerMove = (e: PointerEvent) => {
      app.updateMouseCoordinates(e.clientX, e.clientY);
      if (!document.body.classList.contains('is-teaser')) {
        const hit = app.checkHover(e.clientX, e.clientY);
        document.body.style.cursor = hit ? 'pointer' : 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;
      if (e.target !== app.renderer.domElement) return;
      app.handleClick(e.clientX, e.clientY);
    };

    const handleWheel = (e: WheelEvent) => {
      if (document.body.classList.contains('is-teaser')) {
        if (e.deltaY > 2) {
          startPortfolio();
        }
        return;
      }

      if (app.isTransitioning) {
        if (app.teaserTimeline?.isActive()) {
          app.teaserTimeline.timeScale(3.0);
        }
        return;
      }

      // Se usuário interagir durante o snap automático, cancela imediatamente e devolve o controle manual
      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }

      // Se estiver no topo absoluto (Ato 00) e rolar para cima, retorna ao teaser
      if (targetProgress <= 0.001 && currentProgress <= 0.015 && e.deltaY < -12) {
        returnToTeaser();
        return;
      }

      cancelNavTween();

      lastScrollDelta = e.deltaY;

      // Nos celulares (Ato 01) a rodinha/trackpad folheia os 4 sites antes de seguir para a espiral
      const now = performance.now();
      const newGesture = now - lastWheelAt > 200;
      lastWheelAt = now;
      if (consumePhoneGesture(e.deltaY, newGesture, 60)) {
        scheduleSnap();
        return;
      }

      targetProgress += Math.max(-120, Math.min(120, e.deltaY)) * SCROLL_FACTOR * scrollSpeedAt(targetProgress);
      targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));

      scheduleSnap();
    };

    let touchStartY = 0;
    let touchGestureStart = false;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchGestureStart = true;
      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (document.body.classList.contains('is-teaser')) {
        if (touchStartY - e.touches[0].clientY > 2) {
          startPortfolio();
          touchStartY = e.touches[0].clientY;
        }
        return;
      }

      if (app.isTransitioning) {
        if (app.teaserTimeline?.isActive()) {
          app.teaserTimeline.timeScale(3.0);
        }
        return;
      }

      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }
      cancelNavTween();

      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      lastScrollDelta = deltaY;

      if (targetProgress <= 0.001 && currentProgress <= 0.015 && deltaY < -18) {
        returnToTeaser();
        return;
      }

      const newTouchGesture = touchGestureStart;
      touchGestureStart = false;
      if (consumePhoneGesture(deltaY, newTouchGesture, 40)) {
        scheduleSnap();
        return;
      }

      targetProgress += deltaY * SCROLL_FACTOR * scrollSpeedAt(targetProgress);
      targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));

      scheduleSnap();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('click', handleClick);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Loop contínuo de lerp para rolagem
    const updateScrollLoop = () => {
      animFrameId = requestAnimationFrame(updateScrollLoop);

      if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;

      targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));
      if (Math.abs(targetProgress - currentProgress) > 0.0001) {
        currentProgress += (targetProgress - currentProgress) * (reducedMotion.matches ? 1 : 0.18);
        currentProgress = Math.max(0.0, Math.min(1.0, currentProgress));
        if (app.masterTimeline) {
          app.masterTimeline.progress(currentProgress);
        }
      }

      const activeTime = app.masterTimeline ? app.masterTimeline.time() : currentProgress * 100;
      const activeChapter = chapterAt(activeTime);
      if (activeChapter !== lastChapter) {
        lastChapter = activeChapter;
        onChapterChangeRef.current?.(activeChapter);
      }
      onProgressChangeRef.current?.(currentProgress);
    };
    animFrameId = requestAnimationFrame(updateScrollLoop);

    // 2. CICLO DE DESMONTAGEM SEGURO: .dispose() em Three.js, shaders, renderizador e listeners
    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);

      if (snapTimeout) clearTimeout(snapTimeout);
      if (snapTween) snapTween.kill();
      app.navTween?.kill();

      app.dispose();
      appRef.current = null;
      if (window.portfolioApp === app) {
        delete window.portfolioApp;
      }
    };
  }, []);

  return (
    <>
      <div id="webgl-container" ref={containerRef} />
      <div id="chapter-curtain" ref={curtainRef} className="chapter-curtain" aria-hidden="true" />
    </>
  );
};
