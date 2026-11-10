import React, { useState, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { WebGLCanvas } from './WebGLCanvas';
import { IntroTeaser } from './IntroTeaser';
import { ChapterTracker } from './ChapterTracker';
import { PhoneStage } from './PhoneStage';
import { ProjectModal } from './ProjectModal';
import { EditorialHUD } from './EditorialHUD';
import { FilmGrainOverlay } from './FilmGrainOverlay';
import { sitesData } from '../data/sites.js';
import { projectsData } from '../data/projects.js';
import type { ProjectItem } from '../types/portfolio';

export const PortfolioApp: React.FC = () => {
  const [isTeaser, setIsTeaser] = useState<boolean>(true);
  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0.0);
  const [siteIndex, setSiteIndex] = useState<number>(0);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const currentSite = sitesData[siteIndex] || sitesData[0];

  // Sincronização do indicador visual no tracker lateral
  useEffect(() => {
    document.body.dataset.chapter = String(activeChapter);
    const indicator = document.getElementById('tracker-indicator');
    if (indicator) {
      indicator.style.transform = `translateY(${activeChapter * 46}px)`;
    }
  }, [activeChapter]);

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

    if (isTeaser) {
      handleEnter();
    }

    const destinations = [0.00, 0.35, 0.60, 0.90];
    const destination = destinations[chapter];
    const assemblyStarts = [0.04, 0.235, 0.50, 0.82];
    const startProgress = assemblyStarts[chapter];

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const curtainEl = document.getElementById('chapter-curtain');

    if (reducedMotion.matches || !curtainEl) {
      app.setProgress?.(destination);
      setActiveChapter(chapter);
      return;
    }

    const tl = gsap.timeline();
    tl.to(curtainEl, { opacity: 1, duration: 0.14, ease: 'power1.in' })
      .add(() => {
        app.setProgress?.(startProgress);
        setActiveChapter(chapter);

        const state = { p: startProgress };
        gsap.to(state, {
          p: destination,
          duration: 0.9,
          ease: 'power2.out',
          onUpdate: () => {
            app.setProgress?.(state.p);
          },
          onComplete: () => {
            app.setProgress?.(destination);
          }
        });
      })
      .to(curtainEl, { opacity: 0, duration: 0.16, ease: 'power1.out' });
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
      if (e.target instanceof Element && e.target.closest('details, input, textarea, select')) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleSelectChapter(Math.min(3, activeChapter + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handleSelectChapter(Math.max(0, activeChapter - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleSelectChapter(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        handleSelectChapter(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChapter, handleSelectChapter]);

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

      <ProjectModal
        isOpen={Boolean(selectedProject)}
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      <main className="sr-only">
        <h1>Camilla Paschoal — design e desenvolvimento web</h1>
        <nav aria-label="Links diretos">
          <a href="https://aconchegoeventos.pages.dev">Aconchego Festas e Eventos</a>
          <a href="https://ccpaschoal.github.io/vanessachavestdah/">Vanessa Chaves</a>
          <a href="https://ccpaschoal.github.io/hamburgueria/">Chapa 62</a>
          <a href="https://lojaaura.pages.dev/">Loja AURA</a>
          <a href="https://wa.me/5521982566564">WhatsApp</a>
          <a href="https://www.linkedin.com/in/camillapaschoal/">LinkedIn</a>
          <a href="https://github.com/ccpaschoal">GitHub</a>
          <a href="mailto:camillacpaschoal@gmail.com">E-mail</a>
        </nav>
      </main>
    </>
  );
};
