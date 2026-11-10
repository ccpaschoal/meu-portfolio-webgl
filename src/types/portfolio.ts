import type * as THREE from 'three';
import type gsap from 'gsap';

export interface ProjectItem {
  id: string;
  title: string;
  tag: string;
  photos: string[];
  thumb: string;
}

export interface SiteItem {
  id: string;
  title: string;
  tag: string;
  description: string;
  thumb: string;
  image: string;
  link: string;
  href: string;
}

export interface ContactItem {
  key: string;
  label: string;
  symbol: string;
  href: string;
}

export interface ProjectModalProps {
  isOpen: boolean;
  project: ProjectItem | null;
  onClose: () => void;
}

export interface ChapterTrackerProps {
  activeChapter: number;
  onSelectChapter: (index: number) => void;
}

export interface IntroTeaserProps {
  visible: boolean;
  onEnter: () => void;
}

export interface PhoneStageProps {
  currentSite: SiteItem;
  currentIndex: number;
  totalSites: number;
  onPrev: () => void;
  onNext: () => void;
}

export interface PortfolioSceneInstance {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dustParticles?: THREE.Points;
  dustGeometry?: THREE.BufferGeometry;
  dustMaterial?: THREE.ShaderMaterial;
  currentChapter: number;
  isTransitioning: boolean;
  masterTimeline?: gsap.core.Timeline;
  teaserTimeline?: gsap.core.Timeline;
  triggerTeaserReveal: () => void;
  hideToTeaser: (cb?: () => void) => void;
  updateMouseCoordinates: (x: number, y: number) => void;
  checkHover: (x: number, y: number) => boolean;
  handleClick: (x: number, y: number) => void;
  activeSiteIndex?: number;
  showSite?: (direction: number) => Promise<boolean>;
  nextPhoneSite: () => void;
  prevPhoneSite: () => void;
  getCurrentSiteIndex: () => number;
  onSiteChange?: (site: SiteItem, index: number, total: number) => void;
  setProgress?: (p: number) => void;
  /** Progresso (0–1) em que cada lâmina da espiral fica de frente */
  spiralStops?: number[];
  /** Progresso (0–1) em que cada site fica de frente no círculo de celulares */
  phoneStops?: number[];
  /** Desliza a narrativa até um progresso (resolve true ao chegar, false se a rolagem interromper) */
  glideTo?: (p: number, duration?: number) => Promise<boolean>;
  phonesList?: THREE.Object3D[];
  /** Animação de navegação do tracker/teclado (a rolagem manual a cancela) */
  navTween?: gsap.core.Animation | null;
  dispose: () => void;
}

declare global {
  interface Window {
    portfolioApp?: PortfolioSceneInstance;
  }
}
