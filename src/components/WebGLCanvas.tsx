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

    // Cada clique da rodinha anda pouco (≈1,8s da narrativa): páginas mais longas e deslize contido
    const SCROLL_FACTOR = 0.00018;
    // A narrativa nunca corre mais que isto à frente do que está na tela: num giro forte da
    // rodinha os objetos aceleram, mas não "teletransportam" de um ato para outro
    const MAX_LEAD = 0.045;
    // Quanto do caminho restante a tela percorre por quadro (mais alto = menos arraste depois de parar)
    const FOLLOW = 0.24;
    // Pausa depois do último evento de rolagem antes de assentar na próxima parada
    const SETTLE_DELAY = 300;
    // Na espiral a rolagem anda mais devagar para dar para ver cada lâmina (~1,5 lâmina por clique)
    const scrollSpeedAt = (p: number) => {
      const stops = spiralStops();
      return p >= stops[0] - 0.01 && p <= stops[stops.length - 1] + 0.01 ? 0.6 : 1;
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const curtainEl = curtainRef.current;

    let snapTimeout: ReturnType<typeof setTimeout> | null = null;
    let snapTween: gsap.core.Tween | null = null;
    let lastWheelAt = 0;
    // Onde o gesto atual começou: o assentamento segue a direção do gesto a partir daqui
    let gestureOrigin = 0;
    // O giro de rodinha que revela o site termina ali: a narrativa só anda num gesto novo
    let revealGestureActive = false;

    // Começo de cada ato no tempo da master timeline (0–100s)
    const CONTACT_PLATEAU = 0.90;
    const CHAPTER_STARTS = [0, 24, 46, 76];
    const chapterAt = (time: number) => {
      let chapter = 0;
      for (let i = 1; i < CHAPTER_STARTS.length; i++) if (time >= CHAPTER_STARTS[i]) chapter = i;
      return chapter;
    };
    const spiralStops = () => app.spiralStops?.length ? app.spiralStops : [0.49, 0.71];
    const phoneStops = () => app.phoneStops?.length ? app.phoneStops : [0.29, 0.33, 0.37, 0.41];
    // Todas as composições fechadas da narrativa: Polaroids, cada site, cada lâmina e o contato
    const allStops = () => [0, ...phoneStops(), ...spiralStops(), CONTACT_PLATEAU];
    const nearestOf = (stops: number[], p: number) => {
      let nearest = stops[0];
      for (const stop of stops) if (Math.abs(stop - p) < Math.abs(nearest - p)) nearest = stop;
      return nearest;
    };
    const clampLead = (p: number) =>
      Math.max(0, Math.min(1, Math.max(currentProgress - MAX_LEAD, Math.min(currentProgress + MAX_LEAD, p))));

    // Para onde a rolagem assenta quando a pessoa para: a próxima composição na direção do gesto
    // (um clique já leva ao próximo site, lâmina ou ato; um giro forte assenta na mais próxima)
    const calculateSnapTarget = (p: number) => {
      const stops = allStops();
      const moved = p - gestureOrigin;
      if (Math.abs(moved) < 0.003) return nearestOf(stops, p);
      const ahead = moved > 0
        ? stops.filter(stop => stop > gestureOrigin + 0.0005)
        : stops.filter(stop => stop < gestureOrigin - 0.0005);
      return ahead.length ? nearestOf(ahead, p) : nearestOf(stops, p);
    };

    const scheduleSnap = () => {
      if (snapTimeout) clearTimeout(snapTimeout);
      if (reducedMotion.matches) return;

      snapTimeout = setTimeout(() => {
        if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;

        const destination = calculateSnapTarget(targetProgress);
        gestureOrigin = destination;
        if (Math.abs(targetProgress - destination) < 0.00005) return;

        snapTween?.kill();
        const distance = Math.abs(destination - targetProgress);
        const state = { p: targetProgress };
        snapTween = gsap.to(state, {
          p: destination,
          // vizinho (site/lâmina): chegada curta que desacelera; troca de ato: acelera e freia
          duration: distance > 0.05 ? Math.min(1.25, 0.55 + distance * 2.5) : 0.42 + distance * 6,
          ease: distance > 0.05 ? 'power2.inOut' : 'expo.out',
          onUpdate: () => {
            targetProgress = state.p;
          },
          onComplete: () => {
            targetProgress = destination;
            snapTween = null;
          }
        });
      }, SETTLE_DELAY);
    };

    app.setProgress = (p: number) => {
      if (snapTimeout) clearTimeout(snapTimeout);
      snapTween?.kill();
      snapTween = null;
      targetProgress = Math.max(0.0, Math.min(1.0, p));
      currentProgress = targetProgress;
      gestureOrigin = targetProgress;
      if (app.masterTimeline) {
        app.masterTimeline.progress(targetProgress);
      }
    };

    // Desliza a narrativa até um ponto (troca de site pelo teclado). A rolagem manual cancela.
    app.glideTo = (p: number, duration = 0.8) => new Promise<boolean>((resolve) => {
      app.navTween?.kill();
      const state = { p: currentProgress };
      const tween = gsap.to(state, {
        p: Math.max(0, Math.min(1, p)),
        duration: reducedMotion.matches ? 0 : duration,
        ease: 'power2.inOut',
        onUpdate: () => app.setProgress?.(state.p),
        onComplete: () => {
          if (app.navTween === tween) app.navTween = null;
          resolve(true);
        },
        onInterrupt: () => resolve(false)
      });
      app.navTween = tween;
    });

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
      const now = performance.now();
      const newGesture = now - lastWheelAt > 250;
      lastWheelAt = now;

      if (document.body.classList.contains('is-teaser')) {
        if (e.deltaY > 2) {
          startPortfolio();
          revealGestureActive = true;
        }
        return;
      }

      // O resto do giro que revelou o site só acelera a abertura das Polaroids
      if (revealGestureActive && !newGesture) {
        if (app.teaserTimeline?.isActive()) app.teaserTimeline.timeScale(3.0);
        return;
      }
      revealGestureActive = false;

      if (app.isTransitioning) {
        if (app.teaserTimeline?.isActive()) app.teaserTimeline.timeScale(3.0);
        return;
      }

      // Se usuário interagir durante o snap automático, cancela imediatamente e devolve o controle manual
      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }

      // Voltar para a tela preta: só num gesto novo para cima, já parado no topo
      if (newGesture && targetProgress <= 0.001 && currentProgress <= 0.004 && e.deltaY < -12) {
        returnToTeaser();
        return;
      }

      cancelNavTween();
      if (newGesture) gestureOrigin = targetProgress;
      targetProgress = clampLead(
        targetProgress + Math.max(-120, Math.min(120, e.deltaY)) * SCROLL_FACTOR * scrollSpeedAt(targetProgress)
      );
      scheduleSnap();
    };

    let touchStartY = 0;
    let touchStartedAtTop = false;
    let touchRevealGesture = false;
    let touchPull = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartedAtTop = targetProgress <= 0.001 && currentProgress <= 0.004;
      touchRevealGesture = false;
      touchPull = 0;
      gestureOrigin = targetProgress;
      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      if (document.body.classList.contains('is-teaser')) {
        if (touchStartY - y > 2) {
          startPortfolio();
          touchRevealGesture = true;
          touchStartY = y;
        }
        return;
      }

      // O mesmo toque que revelou o site (ou a abertura em andamento) não move a narrativa
      if (touchRevealGesture || app.isTransitioning) {
        if (app.teaserTimeline?.isActive()) app.teaserTimeline.timeScale(3.0);
        touchStartY = y;
        return;
      }

      if (snapTween) {
        snapTween.kill();
        snapTween = null;
      }
      cancelNavTween();

      const deltaY = touchStartY - y;
      touchStartY = y;

      // Puxar para baixo num toque que começou parado no topo volta para a tela preta
      if (touchStartedAtTop && deltaY < 0) {
        touchPull -= deltaY;
        if (touchPull > 60) returnToTeaser();
        return;
      }

      targetProgress = clampLead(targetProgress + deltaY * SCROLL_FACTOR * scrollSpeedAt(targetProgress));
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
        currentProgress += (targetProgress - currentProgress) * (reducedMotion.matches ? 1 : FOLLOW);
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
