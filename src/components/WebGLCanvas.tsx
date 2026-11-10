import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PortfolioScene } from '../scene.js';
import type { PortfolioSceneInstance } from '../types/portfolio';

export interface WebGLCanvasProps {
  onChapterChange?: (chapter: number) => void;
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
  onTeaserTriggered,
  onTeaserReturn,
  onSiteChange
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PortfolioSceneInstance | null>(null);
  const trackerTweenRef = useRef<gsap.core.Tween | null>(null);
  const curtainTweenRef = useRef<gsap.core.Timeline | null>(null);

  const onChapterChangeRef = useRef(onChapterChange);
  onChapterChangeRef.current = onChapterChange;

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

    const SCROLL_FACTOR = 0.00018;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const curtainEl = curtainRef.current;

    app.setProgress = (p: number) => {
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

    // Callback de troca de site nos smartphones 3D
    app.onSiteChange = (idx: number) => {
      onSiteChangeRef.current?.(idx);
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

      if (targetProgress <= 0.001 && currentProgress <= 0.015 && e.deltaY < -12) {
        returnToTeaser();
        return;
      }

      if (curtainTweenRef.current?.isActive()) {
        curtainTweenRef.current.kill();
        if (curtainEl) curtainEl.style.opacity = '0';
        currentProgress = app.masterTimeline?.progress() ?? currentProgress;
        targetProgress = currentProgress;
      }

      if (trackerTweenRef.current?.isActive()) {
        trackerTweenRef.current.kill();
        currentProgress = app.masterTimeline?.progress() ?? currentProgress;
        targetProgress = currentProgress;
      }

      targetProgress += Math.max(-120, Math.min(120, e.deltaY)) * SCROLL_FACTOR;
      targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
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

      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;

      if (targetProgress <= 0.001 && currentProgress <= 0.015 && deltaY < -18) {
        returnToTeaser();
        return;
      }

      targetProgress += deltaY * SCROLL_FACTOR;
      targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));
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
      const activeChapter = Math.min(3, Math.floor(activeTime / 25));
      if (activeChapter !== lastChapter) {
        lastChapter = activeChapter;
        onChapterChangeRef.current?.(activeChapter);
      }
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

      if (trackerTweenRef.current) trackerTweenRef.current.kill();
      if (curtainTweenRef.current) curtainTweenRef.current.kill();

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
