import './style.css';
import { PortfolioScene } from './scene.js';
import gsap from 'gsap';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('webgl-container');
  const app = new PortfolioScene(container);
  window.portfolioApp = app;

  // Atualização em tempo real das coordenadas do cursor e raycasting tátil
  window.addEventListener('pointermove', (e) => {
    app.updateMouseCoordinates(e.clientX, e.clientY);
    if (!document.body.classList.contains('is-teaser')) {
      const hit = app.checkHover(e.clientX, e.clientY);
      document.body.style.cursor = hit ? 'pointer' : 'default';
    }
  }, { passive: true });

  // Clique interativo nos objetos 3D (smartphones, teclas de contato do VHS)
  window.addEventListener('click', (e) => {
    if (document.body.classList.contains('is-teaser') || app.isTransitioning) return;
    if (e.target !== app.renderer.domElement) return;
    app.handleClick(e.clientX, e.clientY);
  });

  // 1. DISPARO DO PRÓLOGO / TEASER (ENTRADA NO PORTFÓLIO)
  const teaserEl = document.getElementById('intro-teaser');
  let hasTriggered = false;

  const startPortfolio = () => {
    if (hasTriggered || app.isTransitioning) return;
    hasTriggered = true;

    document.body.classList.remove('is-teaser');
    if (teaserEl) {
      teaserEl.style.opacity = '0';
      teaserEl.style.pointerEvents = 'none';
    }

    app.triggerTeaserReveal();
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
      if (teaserEl) {
        teaserEl.style.pointerEvents = 'auto';
        teaserEl.style.opacity = '1';
      }
      updateTrackerUI(0);
    });
  };

  if (teaserEl) {
    teaserEl.addEventListener('click', startPortfolio);
    teaserEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') startPortfolio();
    });
  }

  // 2. VIRTUAL SCROLL SCRUB (CONTROLE DA MASTER TIMELINE DE 0.0 A 1.0)
  let targetProgress = 0.0;
  let currentProgress = 0.0;
  // Fator de rolagem narrativa ágil, suave e uniforme por todos os 4 atos
  const SCROLL_FACTOR = 0.00018;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let trackerTween;
  let curtainTween;
  const curtainEl = document.getElementById('chapter-curtain');

  app.setProgress = (p) => {
    targetProgress = Math.max(0.0, Math.min(1.0, p));
    currentProgress = targetProgress;
    if (app.masterTimeline) {
      app.masterTimeline.progress(targetProgress);
    }
  };

  window.addEventListener('wheel', (e) => {
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

    // Se estiver no topo absoluto (Ato 00) e rolar para cima, retorna para a tela preta (teaser)
    if (targetProgress <= 0.001 && currentProgress <= 0.015 && e.deltaY < -12) {
      returnToTeaser();
      return;
    }

    if (curtainTween && curtainTween.isActive()) {
      curtainTween.kill();
      if (curtainEl) curtainEl.style.opacity = '0';
      currentProgress = app.masterTimeline?.progress() ?? currentProgress;
      targetProgress = currentProgress;
    }

    if (trackerTween && trackerTween.isActive()) {
      trackerTween.kill();
      currentProgress = app.masterTimeline?.progress() ?? currentProgress;
      targetProgress = currentProgress;
    }

    // Rolagem consistente e uniforme por toda a narrativa contínua
    targetProgress += Math.max(-120, Math.min(120, e.deltaY)) * SCROLL_FACTOR;
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));
  }, { passive: true });

  // Suporte a Toque Móvel / Trackpad
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
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

    // Se estiver no topo e arrastar para baixo (gesto de rolar para cima), volta para o teaser
    if (targetProgress <= 0.001 && currentProgress <= 0.015 && deltaY < -18) {
      returnToTeaser();
      return;
    }

    if (curtainTween && curtainTween.isActive()) {
      curtainTween.kill();
      if (curtainEl) curtainEl.style.opacity = '0';
      currentProgress = app.masterTimeline?.progress() ?? currentProgress;
      targetProgress = currentProgress;
    }

    if (trackerTween && trackerTween.isActive()) {
      trackerTween.kill();
      currentProgress = app.masterTimeline?.progress() ?? currentProgress;
      targetProgress = currentProgress;
    }

    targetProgress += deltaY * SCROLL_FACTOR;
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress));
  }, { passive: true });

  // 3. SINCRONIZAÇÃO DO TRACKER LATERAL DIREITO MONOESPAÇADO
  const trackerItems = document.querySelectorAll('.tracker-list li');
  const trackerIndicator = document.getElementById('tracker-indicator');
  let lastChapter = 0;

  const updateTrackerUI = (chapterIndex) => {
    document.body.dataset.chapter = String(chapterIndex);
    trackerItems.forEach(item => {
      const active = parseInt(item.dataset.chapter, 10) === chapterIndex;
      item.classList.toggle('active', active);
      const button = item.querySelector('button');
      if (active) button?.setAttribute('aria-current', 'step');
      else button?.removeAttribute('aria-current');
    });
    if (trackerIndicator) {
      trackerIndicator.style.transform = `translateY(${chapterIndex * 46}px)`;
    }
  };
  updateTrackerUI(0);

  const siteCaption = document.getElementById('site-caption');
  app.onSiteChange = (site, index, total) => {
    if (siteCaption) siteCaption.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${site.title}`;
  };
  document.getElementById('site-prev')?.addEventListener('click', () => app.showSite(-1));
  document.getElementById('site-next')?.addEventListener('click', () => app.showSite(1));

  const navigateToChapter = (chapter) => {
    if (document.body.classList.contains('is-teaser')) startPortfolio();
    // Destinos calibrados nos platôs de estabilidade:
    // 00 MATRIZ: 0.00 (polaroids abertas)
    // 01 PELÍCULA: 0.35 (35s: 6 lâminas montadas perfeitamente no centro com gap 0)
    // 02 DIGITAL: 0.60 (60s: smartphone central já pousado, escalado 1.0 e interativo)
    // 03 ARQUIVO: 0.90 (90s: fita VHS encaixada, deck ancorado, LED aceso e teclas de contato ativas)
    const destinations = [0.00, 0.35, 0.60, 0.90];
    const destination = destinations[chapter];

    // Início da montagem de cada capítulo (para saltar direto e terminar de montar no centro):
    // 00 MATRIZ: 0.04 (polaroids descem e assentam suavemente)
    // 01 PELÍCULA: 0.235 (as 6 fotos convergem dos cantos e unem-se perfeitamente no centro)
    // 02 DIGITAL: 0.50 (smartphone conclui a aproximação e escala de 1.0, títulos revelam)
    // 03 ARQUIVO: 0.82 (deck já ancorado, fita cassete conclui subida e encaixe na gaveta com LED)
    const assemblyStarts = [0.04, 0.235, 0.50, 0.82];
    const startProgress = assemblyStarts[chapter];

    const currentChapter = Math.min(3, Math.floor((app.masterTimeline?.time() || 0) / 25));

    trackerTween?.kill();
    curtainTween?.kill();

    // Se já estiver no capítulo e no platô, não precisa reprocessar
    if (currentChapter === chapter && Math.abs((app.masterTimeline?.progress() ?? currentProgress) - destination) < 0.005) {
      return;
    }

    // Com movimento reduzido ou sem cortina, salta diretamente sem transição
    if (reducedMotion.matches || !curtainEl) {
      app.setProgress(destination);
      updateTrackerUI(chapter);
      return;
    }

    // Dissolve cinematográfico: corte rápido de 140ms para o escuro, teletransporte direto
    // ao início da montagem do capítulo escolhido (sem cruzar outros atos) e término da montagem
    curtainTween = gsap.timeline();

    curtainTween
      .to(curtainEl, { opacity: 1, duration: 0.14, ease: 'power1.in' })
      .add(() => {
        // Pula diretamente para o ato desejado no ponto de finalização da montagem
        app.setProgress(startProgress);
        updateTrackerUI(chapter);

        const state = { p: startProgress };
        trackerTween?.kill();
        trackerTween = gsap.to(state, {
          p: destination,
          duration: 0.9,
          ease: 'power2.out',
          onUpdate: () => {
            app.setProgress(state.p);
          },
          onComplete: () => {
            app.setProgress(destination);
            trackerTween = null;
          }
        });
      })
      .to(curtainEl, { opacity: 0, duration: 0.16, ease: 'power1.out' });
  };

  trackerItems.forEach(item => {
    const handleChapterClick = (e) => {
      e.stopPropagation();
      const ch = parseInt(item.dataset.chapter, 10);
      if (ch === 0 && currentProgress <= 0.005 && targetProgress <= 0.005) {
        returnToTeaser();
        return;
      }
      navigateToChapter(ch);
    };
    item.addEventListener('click', handleChapterClick);
    item.querySelector('button')?.addEventListener('click', handleChapterClick);
  });

  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('is-teaser') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest('details, input, textarea, select')) return;
    const active = Math.min(3, Math.floor((app.masterTimeline?.time() || 0) / 25));
    let next;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') next = Math.min(3, active + 1);
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') next = Math.max(0, active - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 3;
    else return;
    e.preventDefault();
    navigateToChapter(next);
  });

  // 4. TIPOGRAFIA CINEMÁTICA: LETRA POR LETRA (PADRÃO VANESSA CHAVES)
  document.querySelectorAll('.phone-headline, .phone-subcopy').forEach((el) => {
    let c = 0;
    const text = el.textContent.trim();
    el.innerHTML = '';
    const words = text.split(/(\s+)/);
    words.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        el.append(' ');
        return;
      }
      const w = document.createElement('span');
      w.className = 'palavra-t';
      [...part].forEach((ch) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.setProperty('--c', c++);
        w.append(s);
      });
      el.append(w);
    });
    el.classList.add('is-split');
  });

  // Loop de Interpolação do Scroll (Lerp 0.18: resposta imediata e sem atraso na rolagem)
  function updateScrollLoop() {
    requestAnimationFrame(updateScrollLoop);

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
      updateTrackerUI(activeChapter);
    }
  }
  updateScrollLoop();
});
