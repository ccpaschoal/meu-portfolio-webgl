import { gsap } from 'gsap';
import { projectsData } from '../data/projects.js';
import { sitesData } from '../data/sites.js';
import { contacts } from '../data/contacts.js';
import { preloadAssets } from './preloader.js';
import { CinematicScene } from './three-scene.js';
import { CinematicStory, playIntroduction } from './gsap-animations.js';

export let experience = null;
const events = new AbortController();
const signal = events.signal;
const on = (element, type, callback, options = {}) => element?.addEventListener(type, callback, { ...options, signal });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const preloader = document.querySelector('#preloader');
const sceneRoot = document.querySelector('#scene-root');
const header = document.querySelector('.site-header');
const transport = document.querySelector('#project-transport');
const viewer = document.querySelector('#phone-viewer');
const slider = viewer.querySelector('.phone-slider');
const phoneModel = document.querySelector('#phone-3d-model');
const phoneGlare = document.querySelector('.phone-glare');

let selectedProject = null;
let currentPhoto = 0;
let previousFocus = null;
let previousOverflow = '';
let intro = null;
let disposed = false;

// Controle de rotação 3D interativa do celular
let isPhoneDragging = false;
let phonePointerStart = { x: 0, y: 0 };
let phoneCurrentRot = { x: 0, y: 0 };

function updatePhoneTransform() {
  if (!phoneModel) return;
  phoneModel.style.transform = `perspective(1200px) rotateX(${phoneCurrentRot.x}deg) rotateY(${phoneCurrentRot.y}deg)`;
  if (phoneGlare) {
    const glareX = 50 + phoneCurrentRot.y * 1.4;
    const glareY = 50 + phoneCurrentRot.x * 1.4;
    phoneGlare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.18) 0%, transparent 65%)`;
  }
}

if (phoneModel) {
  on(phoneModel, 'pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    isPhoneDragging = true;
    phonePointerStart.x = e.clientX;
    phonePointerStart.y = e.clientY;
    phoneModel.setPointerCapture?.(e.pointerId);
    gsap.killTweensOf(phoneCurrentRot);
  });

  on(window, 'pointermove', (e) => {
    if (!isPhoneDragging) return;
    const dx = e.clientX - phonePointerStart.x;
    const dy = e.clientY - phonePointerStart.y;
    phonePointerStart.x = e.clientX;
    phonePointerStart.y = e.clientY;

    phoneCurrentRot.y = Math.max(-46, Math.min(46, phoneCurrentRot.y + dx * 0.38));
    phoneCurrentRot.x = Math.max(-28, Math.min(28, phoneCurrentRot.x - dy * 0.38));
    updatePhoneTransform();
  });

  const endPhoneDrag = (e) => {
    if (!isPhoneDragging) return;
    isPhoneDragging = false;
    if (e?.pointerId && phoneModel?.hasPointerCapture?.(e.pointerId)) {
      phoneModel.releasePointerCapture(e.pointerId);
    }
    gsap.to(phoneCurrentRot, {
      x: 0,
      y: 0,
      duration: 0.65,
      ease: 'back.out(1.4)',
      onUpdate: updatePhoneTransform
    });
  };

  on(window, 'pointerup', endPhoneDrag);
  on(window, 'pointercancel', endPhoneDrag);
}

function makeImage(source, alt, assets) {
  const image = assets.get(source)?.cloneNode(true) || new Image();
  image.src = source;
  image.alt = alt;
  image.decoding = 'async';
  image.draggable = false;
  return image;
}

function createFrames(assets) {
  return projectsData.map((project, index) => {
    const card = document.createElement('article');
    card.className = 'film-project-card';
    card.dataset.id = project.id;
    card.setAttribute('aria-label', project.title);

    const image = makeImage(project.photos[0], project.title, assets);
    image.className = 'card-thumb';

    const media = document.createElement('div');
    media.className = 'frame-media';
    media.append(image);

    const noise = document.createElement('div');
    noise.className = 'frame-noise';
    noise.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'card-info';

    const tag = document.createElement('span');
    tag.className = 'card-cat';
    tag.textContent = project.tag;

    const title = document.createElement('h3');
    title.className = 'card-name';
    title.textContent = project.title;

    const controls = document.createElement('div');
    controls.className = 'inline-carousel-controls';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', `Imagem anterior de ${project.title}`);

    const counter = document.createElement('span');
    counter.textContent = `1 / ${project.photos.length}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '›';
    next.setAttribute('aria-label', `Próxima imagem de ${project.title}`);

    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'frame-open';
    expand.textContent = 'Ampliar';

    let inlineIndex = 0;
    const changeInline = (direction) => {
      inlineIndex = (inlineIndex + direction + project.photos.length) % project.photos.length;
      image.src = project.photos[inlineIndex];
      image.alt = `${project.title}, imagem ${inlineIndex + 1}`;
      counter.textContent = `${inlineIndex + 1} / ${project.photos.length}`;
    };

    on(prev, 'click', (event) => { event.stopPropagation(); changeInline(-1); });
    on(next, 'click', (event) => { event.stopPropagation(); changeInline(1); });
    on(expand, 'click', (event) => { event.stopPropagation(); openProject(project); });

    controls.append(prev, counter, next, expand);
    info.append(tag, title, controls);
    card.append(media, info, noise);

    on(card, 'click', () => {
      if (performance.now() < experience.story.suppressClickUntil) return;
      if (experience.scene.film.activeIndex === index && experience.scene.film.locked) openProject(project);
      else experience.story.goToFrame(index);
    });

    on(card, 'keydown', (event) => {
      if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openProject(project);
      }
    });

    return card;
  });
}

function createPortrait(assets) {
  const photo = document.createElement('figure');
  photo.className = 'polaroid';
  const image = makeImage('/assets/avatar-real.jpg', 'Camilla Paschoal sorrindo', assets);
  const caption = document.createElement('figcaption');
  const name = document.createElement('h3');
  name.textContent = 'Camilla Paschoal';
  const role = document.createElement('span');
  role.className = 'polaroid-role';
  role.textContent = 'Web design & social media';
  const description = document.createElement('p');
  description.textContent = 'Sou designer de Social Media e transformo ideias em conteúdo que dá vontade de ler (e de salvar).';
  const detail = document.createElement('p');
  detail.className = 'polaroid-detail';
  detail.textContent = 'Foco em carrosséis com narrativa, páginas leves e identidades que conectam marcas reais a pessoas reais.';
  caption.append(name, role, description, detail);
  photo.append(image, caption);
  return photo;
}

function createSites(assets) {
  return sitesData.map((site) => {
    const card = document.createElement('article');
    card.className = 'site-projector';
    card.dataset.id = site.id;

    const screen = document.createElement('div');
    screen.className = 'projector-screen';
    const image = makeImage(site.image, `Mockup do site ${site.title}`, assets);
    screen.append(image);

    const footer = document.createElement('footer');
    footer.className = 'projector-footer';
    const copy = document.createElement('div');
    const tag = document.createElement('span');
    tag.className = 'projector-tag';
    tag.textContent = site.tag;
    const title = document.createElement('h3');
    title.textContent = site.title;
    const desc = document.createElement('p');
    desc.textContent = site.description;
    copy.append(tag, title, desc);

    const link = document.createElement('a');
    link.href = site.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Acessar site ↗';
    link.setAttribute('aria-label', `Visitar ${site.title} em nova aba`);

    footer.append(copy, link);
    card.append(screen, footer);
    return card;
  });
}

function createVHS() {
  const panel = document.createElement('section');
  panel.className = 'vhs-deck';
  panel.setAttribute('aria-label', 'Contatos em formato de videocassete vintage');

  const top = document.createElement('header');
  top.className = 'vhs-top';
  const brand = document.createElement('div');
  brand.className = 'vhs-brand';
  brand.innerHTML = 'PASCHOAL<small>HQ PRO-AUDIO</small>';
  const format = document.createElement('div');
  format.className = 'vhs-format';
  format.textContent = 'HI-FI STEREO / 4-HEAD';
  top.append(brand, format);

  const middle = document.createElement('div');
  middle.className = 'vhs-middle';
  const slot = document.createElement('div');
  slot.className = 'cassette-slot';
  slot.innerHTML = '<span>▲ AUTO REVERSE CASSETTE DECK ▲</span>';
  const display = document.createElement('div');
  display.className = 'vhs-display';
  display.innerHTML = '<span class="vhs-rec">● REC</span><span class="vhs-counter">SP 0:24:00</span>';
  middle.append(slot, display);

  const keys = document.createElement('div');
  keys.className = 'vhs-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Comandos do gravador e canais de contato');

  const symbols = ['▶', '■', '◀◀', '▶▶', '▲'];
  contacts.forEach((item, index) => {
    const key = document.createElement('a');
    key.className = 'vhs-key';
    key.href = item.href;
    key.target = item.href.startsWith('http') ? '_blank' : '_self';
    key.rel = item.href.startsWith('http') ? 'noopener noreferrer' : '';
    key.setAttribute('aria-label', `${item.label}: contato`);

    const led = document.createElement('span');
    led.className = 'vhs-led';
    led.setAttribute('aria-hidden', 'true');

    const symbol = document.createElement('span');
    symbol.className = 'vhs-symbol';
    symbol.textContent = symbols[index] || '▶';

    const icon = document.createElement('span');
    icon.className = 'vhs-icon';
    icon.innerHTML = item.icon;

    const label = document.createElement('span');
    label.className = 'vhs-label';
    label.textContent = item.label;

    key.append(led, symbol, icon, label);

    const press = () => {
      gsap.to(key, { y: 4, scale: 0.98, boxShadow: '0 1px 0 #080c09, inset 0 2px 4px #000c', duration: 0.08, overwrite: 'auto' });
      gsap.to(led, { opacity: 1, boxShadow: '0 0 10px #73d98b', duration: 0.08, overwrite: 'auto' });
    };
    const release = () => {
      gsap.to(key, { y: 0, scale: 1, boxShadow: '0 5px 0 #080c09, 0 8px 12px #0008, inset 0 1px 0 #8b997c66', duration: 0.28, ease: 'back.out(2)', overwrite: 'auto' });
      gsap.to(led, { opacity: 0.4, boxShadow: '0 0 4px #4fae64', duration: 0.2, overwrite: 'auto' });
    };

    on(key, 'pointerdown', press);
    on(key, 'pointerup', release);
    on(key, 'pointerleave', release);
    keys.append(key);
  });

  panel.append(top, middle, keys);
  return panel;
}

function openProject(project) {
  if (selectedProject || !experience.story) return;
  selectedProject = project;
  currentPhoto = 0;
  experience.story.suspend();
  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  document.querySelector('#phone-title').textContent = project.title;
  document.querySelector('#phone-tag').textContent = project.tag;

  const fragment = document.createDocumentFragment();
  project.photos.forEach((source, index) => {
    const image = new Image();
    image.src = source;
    image.alt = `${project.title}, imagem ${index + 1} de ${project.photos.length}`;
    image.decoding = 'async';
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.classList.toggle('active', index === 0);
    fragment.append(image);
  });
  slider.replaceChildren(fragment);
  updateCounter();

  sceneRoot.inert = true;
  header.inert = true;
  transport.inert = true;
  viewer.inert = false;
  viewer.setAttribute('aria-hidden', 'false');
  viewer.classList.add('active');
  viewer.querySelector('.close-btn').focus({ preventScroll: true });

  phoneCurrentRot.x = 0;
  phoneCurrentRot.y = 0;
  updatePhoneTransform();
  gsap.fromTo(phoneModel, { scale: 0.92, y: 24 }, { scale: 1, y: 0, duration: reducedMotion() ? 0 : 0.45, ease: 'back.out(1.25)', overwrite: true });
}

function updateCounter() {
  document.querySelector('#phone-counter').textContent = `${currentPhoto + 1} / ${selectedProject.photos.length}`;
}

function changePhoto(direction) {
  if (!selectedProject) return;
  const images = slider.querySelectorAll('img');
  images[currentPhoto].classList.remove('active');
  currentPhoto = (currentPhoto + direction + images.length) % images.length;
  images[currentPhoto].classList.add('active');
  updateCounter();
}

function closeProject() {
  if (!selectedProject) return;
  selectedProject = null;
  viewer.classList.remove('active');
  viewer.inert = true;
  viewer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = previousOverflow;
  sceneRoot.inert = false;
  header.inert = false;
  transport.inert = document.body.dataset.chapter !== 'projects';

  gsap.killTweensOf(phoneCurrentRot);
  phoneCurrentRot.x = 0;
  phoneCurrentRot.y = 0;
  updatePhoneTransform();

  experience.story.resume();
  previousFocus?.focus({ preventScroll: true });
}

on(viewer.querySelector('.close-btn'), 'click', closeProject);
on(viewer.querySelector('.prev-photo'), 'click', () => changePhoto(-1));
on(viewer.querySelector('.next-photo'), 'click', () => changePhoto(1));
on(viewer, 'click', (event) => {
  if (event.target === viewer || event.target.classList.contains('phone-3d-scene')) closeProject();
});

on(window, 'keydown', (event) => {
  if (!selectedProject) return;
  if (event.key === 'Escape') closeProject();
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    changePhoto(event.key === 'ArrowRight' ? 1 : -1);
  }
  if (event.key === 'Tab') {
    const controls = [...viewer.querySelectorAll('button')];
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      event.preventDefault();
      controls[0].focus();
    }
  }
});

on(document.querySelector('#retry-load'), 'click', () => location.reload());
on(document.querySelector('#prev-project'), 'click', () => experience.story.step(-1));
on(document.querySelector('#next-project'), 'click', () => experience.story.step(1));
document.querySelectorAll('[data-chapter]').forEach((element) => {
  if (element === document.body) return;
  on(element, 'click', (event) => {
    event.preventDefault();
    experience?.story?.goToChapter(element.dataset.chapter, true);
  });
});

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.body.style.overflow = 'hidden';
delete document.body.dataset.started;

const loading = preloadAssets([
  ...projectsData.map((project) => project.photos[0]),
  ...sitesData.map((site) => site.image),
  '/assets/avatar-real.jpg',
  '/assets/logo-cp-96.webp',
]);

loading.ready.then(({ assets }) => {
  if (disposed) return;
  const scene = new CinematicScene({
    container: sceneRoot,
    frames: createFrames(assets),
    portrait: createPortrait(assets),
    vhs: createVHS(),
    sites: createSites(assets),
  });
  experience = { scene, story: null };
  const play = document.querySelector('#play-button');
  play.focus({ preventScroll: true });

  on(play, 'click', (event) => {
    if (intro) return;
    const keyboardEntry = event.detail === 0;
    play.disabled = true;
    preloader.inert = true;
    gsap.to(play, { scale: 0.9, duration: 0.12 });
    intro = playIntroduction(scene, () => {
      preloader.style.display = 'none';
      sceneRoot.inert = false;
      header.inert = false;
      transport.inert = false;
      experience.story = new CinematicStory(scene);
      document.body.style.overflow = '';
      document.body.dataset.started = 'true';
      if (keyboardEntry) header.querySelector('button').focus({ preventScroll: true });
      else { header.tabIndex = -1; header.focus({ preventScroll: true }); }
    });
  });
}).catch((error) => {
  console.error(error);
  document.querySelector('#load-status').textContent = 'Não foi possível iniciar a sessão. Recarregue para tentar novamente.';
  document.querySelector('#retry-load').hidden = false;
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  closeProject();
  events.abort();
  loading.dispose();
  intro?.kill();
  experience?.story?.destroy();
  experience?.scene?.destroy();
  gsap.killTweensOf('.vhs-key');
  gsap.killTweensOf('#play-button');
  gsap.killTweensOf('#preloader');
  gsap.killTweensOf('#phone-3d-model');
  gsap.killTweensOf(phoneCurrentRot);
  document.body.style.overflow = '';
});
