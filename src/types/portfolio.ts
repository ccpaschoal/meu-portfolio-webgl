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

export interface DustParticlesProps {
  count?: number;
  influenceRadius?: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onInit?: (mesh: THREE.Points, geometry: THREE.BufferGeometry, material: THREE.ShaderMaterial) => void;
  onDestroy?: () => void;
}

export interface Carousel3DProps {
  projects: ProjectItem[];
  activeProject?: ProjectItem | null;
  onSelectProject?: (project: ProjectItem) => void;
  visible?: boolean;
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
  dustMesh?: THREE.Points;
  dustGeometry?: THREE.BufferGeometry;
  dustMaterial?: THREE.ShaderMaterial;
  filmSpool?: THREE.Group;
  vhsMesh?: THREE.Mesh;
  phoneGroup?: THREE.Group;
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
  onSiteChange?: (index: number) => void;
  setProgress?: (p: number) => void;
  dispose: () => void;
}

declare global {
  interface Window {
    portfolioApp?: PortfolioSceneInstance;
  }
}
