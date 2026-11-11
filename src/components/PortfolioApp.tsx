import React, { useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { WebGLCanvas } from './WebGLCanvas';
import { IntroTeaser } from './IntroTeaser';
import { ChapterTracker } from './ChapterTracker';
import { PhoneStage } from './PhoneStage';
import { EditorialHUD } from './EditorialHUD';
import { FilmGrainOverlay } from './FilmGrainOverlay';
import { sitesData } from '../data/sites.js';
import { spiralSlidesData } from '../data/spiralSlides.js';

export const PortfolioApp: React.FC = () => {
  const [isTeaser, setIsTeaser] = useState<boolean>(true);
  const [activeChapter, setActiveChapter] = useState<number>(0);
  // Ato de destino da navegação em andamento (teclas rápidas somam a partir dele)
  const navTargetRef = useRef<number | null>(null);
  const [progress, setProgress] = useState<number>(0.0);
  const [siteIndex, setSiteIndex] = useState<number>(0);

  const currentSite = sitesData[siteIndex] || sitesData[0];

  // Sincronização do indicador visual no tracker lateral (centralizado no item ativo, medido no DOM)
  useEffect(() => {
    document.body.dataset.chapter = String(activeChapter);
    const placeIndicator = () => {
      const indicator = document.getElementById('tracker-indicator');
      const rail = indicator?.parentElement;
      const item = document.querySelector<HTMLElement>(`.tracker-list li[data-chapter="${activeChapter}"]`);
      if (!indicator || !rail || !item) return;
      const itemBox = item.getBoundingClientRect();
      const railBox = rail.getBoundingClientRect();
      const y = itemBox.top + itemBox.height / 2 - railBox.top - indicator.offsetHeight / 2;
      indicator.style.transform = `translateY(${y}px)`;
    };
    placeIndicator();
    window.addEventListener('resize', placeIndicator);
    return () => window.removeEventListener('resize', placeIndicator);
  }, [activeChapter, isTeaser]);

  // Transições de entrada e retorno ao teaser
  const handleEnter = useCallback(() => {
    setIsTeaser(false);
    document.body.classList.remove('is-teaser');
    if (window.portfolioApp) {
      window.portfolioApp.triggerTeaserReveal();
    }
  }, []);

  const handleReturnToTeaser = useCallback(() => {
    setIsTeaser(true);
    setActiveChapter(0);
  }, []);

  // Navegação direta entre os 4 Atos com a cortina cinematográfica
  const handleSelectChapter = useCallback((chapter: number) => {
    const app = window.portfolioApp;
    if (!app) return;
    // Durante a chegada/volta das Polaroids a narrativa ainda não pode ser movida
    if (!isTeaser && app.isTransitioning) return;
    // Já a caminho deste ato (tecla repetida ou clique duplo): não reinicia a passagem
    if (app.navTween && app.navTween.progress() < 1 && app.navTween.data === 'chapter' && navTargetRef.current === chapter) return;
    navTargetRef.current = chapter;

    if (isTeaser) {
      handleEnter();
    }

    // Atos 01 e 02 começam no primeiro site / primeira lâmina (as mesmas paradas do snap da rolagem)
    const phoneStart = app.phoneStops?.[0] ?? 0.25;
    const spiralStart = app.spiralStops?.[0] ?? 0.49;
    const destinations = [0.00, phoneStart, spiralStart, 0.90];
    const destination = destinations[chapter];
    const assemblyStarts = [0.04, phoneStart - 0.06, spiralStart - 0.05, 0.82];
    const startProgress = assemblyStarts[chapter];

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const curtainEl = document.getElementById('chapter-curtain');

    // Uma navegação por vez: cliques rápidos substituem a anterior em vez de disputar o progresso
    app.navTween?.kill();
    app.navTween = null;

    if (reducedMotion.matches || !curtainEl) {
      if (curtainEl) curtainEl.style.opacity = '0';
      app.setProgress?.(destination);
      setActiveChapter(chapter);
      return;
    }

    const state = { p: startProgress };
    const tl = gsap.timeline({
      data: 'chapter',
      onComplete: () => {
        if (app.navTween === tl) app.navTween = null;
      }
    });
    tl.to(curtainEl, { opacity: 1, duration: 0.14, ease: 'power1.in' })
      .add(() => {
        app.setProgress?.(startProgress);
        setActiveChapter(chapter);
      })
      .to(state, {
        p: destination,
        duration: 0.9,
        ease: 'power2.out',
        onUpdate: () => {
          app.setProgress?.(state.p);
        },
        onComplete: () => {
          app.setProgress?.(destination);
        }
      })
      .to(curtainEl, { opacity: 0, duration: 0.16, ease: 'power1.out' }, '<');
    app.navTween = tl;
  }, [isTeaser, handleEnter]);

  // Troca de sites nos smartphones centrais
  const handlePrevSite = useCallback(() => {
    if (window.portfolioApp?.prevPhoneSite) {
      window.portfolioApp.prevPhoneSite();
    }
  }, []);

  const handleNextSite = useCallback(() => {
    if (window.portfolioApp?.nextPhoneSite) {
      window.portfolioApp.nextPhoneSite();
    }
  }, []);

  // Teclas de atalho para navegação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.body.classList.contains('is-teaser') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (window.portfolioApp?.isTransitioning) return;
      if (e.target instanceof Element && e.target.closest('details, input, textarea, select')) return;

      // Com uma navegação em andamento, a próxima tecla parte do ato de destino (↓↓ avança dois atos)
      const nav = window.portfolioApp?.navTween;
      const base = nav && nav.progress() < 1 && nav.data === 'chapter' && navTargetRef.current !== null
        ? navTargetRef.current
        : activeChapter;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleSelectChapter(Math.min(3, base + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handleSelectChapter(Math.max(0, base - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleSelectChapter(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        handleSelectChapter(3);
      } else if (activeChapter === 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        // No Ato 01 as setas laterais trocam o site do celular (as setas na tela ficam ocultas)
        e.preventDefault();
        if (e.key === 'ArrowRight') handleNextSite();
        else handlePrevSite();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChapter, handleSelectChapter, handleNextSite, handlePrevSite]);

  // Tipografia dividida letra por letra (efeito estético Vanessa Chaves)
  useEffect(() => {
    document.querySelectorAll('.phone-headline, .phone-subcopy').forEach((el) => {
      if (el.classList.contains('is-split')) return;
      let c = 0;
      const text = el.textContent?.trim() || '';
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
          s.style.setProperty('--c', String(c++));
          w.append(s);
        });
        el.append(w);
      });
      el.classList.add('is-split');
    });
  }, []);

  return (
    <>
      <WebGLCanvas
        onChapterChange={setActiveChapter}
        onProgressChange={setProgress}
        onTeaserTriggered={() => setIsTeaser(false)}
        onTeaserReturn={handleReturnToTeaser}
        onSiteChange={setSiteIndex}
      />

      <FilmGrainOverlay />

      <EditorialHUD
        visible={!isTeaser}
        currentProgress={progress}
        activeChapter={activeChapter}
      />

      <IntroTeaser visible={isTeaser} onEnter={handleEnter} />

      <ChapterTracker
        activeChapter={activeChapter}
        onSelectChapter={handleSelectChapter}
      />

      <PhoneStage
        currentSite={currentSite}
        currentIndex={siteIndex}
        totalSites={sitesData.length}
        onPrev={handlePrevSite}
        onNext={handleNextSite}
      />


      {/* Versão em texto da narrativa 3D (leitores de tela e buscadores); os links aparecem ao receber foco */}
      <nav className="sr-only skip-links" aria-label="Links diretos">
        <a href="https://aconchegoeventos.pages.dev">Aconchego Festas e Eventos</a>
        <a href="https://ccpaschoal.github.io/vanessachavestdah/">Vanessa Chaves</a>
        <a href="https://ccpaschoal.github.io/hamburgueria/">Chapa 62</a>
        <a href="https://lojaaura.pages.dev/">Loja AURA</a>
        <a href="https://wa.me/5521982566564">WhatsApp</a>
        <a href="https://www.linkedin.com/in/camillapaschoal/">LinkedIn</a>
        <a href="https://github.com/ccpaschoal">GitHub</a>
        <a href="mailto:camillacpaschoal@gmail.com">E-mail</a>
      </nav>
      <main className="sr-only">
        <h1>Camilla Paschoal — design e desenvolvimento web</h1>
        <p>Content designer, AI-assisted — carrosséis para Instagram e sites em HTML/CSS no Rio de Janeiro.</p>
        <section aria-labelledby="sr-carrosseis">
          <h2 id="sr-carrosseis">Carrosséis para Instagram</h2>
          <ul>
            {spiralSlidesData.map((slide) => (
              <li key={slide.id}>{slide.category}: {slide.title}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
};
