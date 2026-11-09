import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Continuous 35mm-style ring. CSS3DRenderer owns the wrapper matrices. */
export class FilmRing extends THREE.Group {
  constructor(elements, { radius = 790, height = 340, tilt = 0.15 } = {}) {
    super();
    if (!Array.isArray(elements) || elements.length !== 10) {
      throw new RangeError('The film ring expects exactly ten carousel frames.');
    }
    if (!Number.isFinite(radius) || radius < 500) throw new RangeError('The film radius must be at least 500 CSS pixels.');
    this.name = 'continuous-35mm-film-ring';
    this.radius = radius;
    this.height = height;
    this.reducedMotion = reducedMotion();
    this.rotation.set(tilt, Math.PI, 0);
    this.activeIndex = -1;
    this.locked = false;
    this.lastOpacity = -1;
    this.energy = 0.25;
    this.events = new AbortController();
    this.normal = new THREE.Vector3();
    this.worldPosition = new THREE.Vector3();
    this.toCamera = new THREE.Vector3();
    this.ribbonSegments = [];
    this.frames = [];

    const count = elements.length;
    const step = Math.PI * 2 / count;
    const width = 2 * radius * Math.tan(step / 2) + 8;
    this.ribbon = new THREE.Group();
    this.ribbon.name = 'translucent-amber-film-with-sprockets';
    const segmentCount = count;
    const beltRadius = radius + 1;
    const segmentWidth = 2 * beltRadius * Math.tan(Math.PI / segmentCount) + 8;

    for (let index = 0; index < segmentCount; index += 1) {
      const angle = index * Math.PI * 2 / segmentCount;
      for (const edge of [-1, 1]) {
        const strip = document.createElement('div');
        strip.className = 'film-ribbon-segment';
        strip.setAttribute('aria-hidden', 'true');
        strip.style.width = `${segmentWidth}px`;
        strip.style.pointerEvents = 'none';
        strip.style.background = 'linear-gradient(180deg, rgba(126, 77, 35, 0.76), rgba(67, 38, 18, 0.64))';
        strip.style.borderColor = 'rgba(222, 157, 73, 0.38)';
        strip.style.setProperty('--hole-offset', `${-index * segmentWidth}px`);
        const object = new CSS3DObject(strip);
        object.position.set(-beltRadius * Math.sin(angle), edge * (height / 2 - 10), -beltRadius * Math.cos(angle));
        object.rotation.y = angle;
        this.ribbon.add(object);
        this.ribbonSegments.push(object);
      }
    }
    this.add(this.ribbon);

    elements.forEach((element, index) => {
      const angle = index * step;
      const frameElement = document.createElement('div');
      frameElement.className = 'film-ring-frame';
      frameElement.dataset.frame = String(index + 1).padStart(2, '0');
      frameElement.style.cssText = `width:${width}px;height:${height}px;pointer-events:auto;`;
      frameElement.setAttribute('role', 'group');
      frameElement.setAttribute('aria-label', `Carrossel ${index + 1} de ${count}`);

      const content = document.createElement('div');
      content.className = 'film-ring-content';
      content.style.pointerEvents = 'auto';
      const top = document.createElement('div');
      top.className = 'film-edge-mark film-edge-mark--top';
      top.textContent = `▶ ${String(index + 1).padStart(2, '0')}   KODAK SAFETY FILM`;
      top.setAttribute('aria-hidden', 'true');
      const bottom = document.createElement('div');
      bottom.className = 'film-edge-mark film-edge-mark--bottom';
      bottom.textContent = `EASTMAN 35MM   ·   ${String(index + 1).padStart(2, '0')}`;
      bottom.setAttribute('aria-hidden', 'true');
      element.style.pointerEvents = 'auto';
      element.style.filter = 'contrast(.84) brightness(.76)';
      content.append(top, element, bottom);
      frameElement.append(content);

      const frame = new CSS3DObject(frameElement);
      frame.position.set(-radius * Math.sin(angle), 0, -radius * Math.cos(angle));
      frame.rotation.y = angle;
      frame.userData.basePosition = frame.position.clone();
      frame.userData.angle = angle;
      this.add(frame);
      this.frames.push(frame);

      const lens = (focused) => {
        if (this.activeIndex !== index || !this.locked) return;
        frameElement.classList.toggle('is-focused', focused);
        gsap.to(element, {
          filter: focused ? 'contrast(1.08) brightness(1.04)' : 'contrast(.84) brightness(.76)',
          duration: this.reducedMotion ? 0 : 0.32,
          ease: 'power2.out', overwrite: true,
        });
        const noise = element.querySelector('.frame-noise');
        if (noise) gsap.to(noise, { opacity: focused ? 0 : 0.035, duration: 0.2, overwrite: true });
      };
      for (const [type, focused] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false]]) {
        element.addEventListener(type, () => lens(focused), { signal: this.events.signal });
      }
      frame.userData.focusLens = lens;
    });

    this.setActive(0, true);
  }

  setActive(index, locked = false) {
    index = ((index % this.frames.length) + this.frames.length) % this.frames.length;
    if (this.activeIndex === index && this.locked === locked) return;
    this.activeIndex = index;
    this.locked = locked;
    this.frames.forEach((frame, frameIndex) => {
      const selected = frameIndex === index;
      frame.element.classList.toggle('is-active', selected);
      frame.element.classList.toggle('is-locked', selected && locked);
      const card = frame.element.querySelector('.film-project-card');
      if (card) {
        card.tabIndex = selected ? 0 : -1;
        card.setAttribute('aria-current', String(selected));
        gsap.killTweensOf(card);
        gsap.set(card, { clearProps: 'filter' });
      }
      const focus = selected && locked;
      const base = frame.userData.basePosition;
      const pop = focus ? 1.025 : 1;
      gsap.to(frame.position, {
        x: base.x * pop, z: base.z * pop,
        duration: this.reducedMotion ? 0 : 0.32,
        ease: focus ? 'back.out(1.15)' : 'power2.out', overwrite: true,
      });
      const scale = focus ? (this.focusScale || 1.035) : 1;
      gsap.to(frame.scale, { x: scale, y: scale, z: scale, duration: this.reducedMotion ? 0 : 0.32, ease: 'power2.out', overwrite: true });
      if (focus && frame.element.matches(':hover')) frame.userData.focusLens(true);
    });
    gsap.to(this, { energy: locked ? 0.9 : 0.28, duration: this.reducedMotion ? 0 : 0.25, overwrite: 'auto' });
  }

  setOpacity(value) {
    value = THREE.MathUtils.clamp(value, 0, 1);
    if (Math.abs(value - this.lastOpacity) < 0.002) return;
    this.lastOpacity = value;
    this.frames.forEach((frame) => {
      frame.element.style.opacity = String(value);
      frame.element.inert = value < 0.05;
      frame.element.setAttribute('aria-hidden', String(value < 0.05));
    });
    this.ribbonSegments.forEach((ribbon) => { ribbon.element.style.opacity = String(value * 0.88); });
  }

  updateFaces(camera) {
    this.updateMatrixWorld(true);
    this.frames.forEach((frame) => {
      frame.getWorldPosition(this.worldPosition);
      this.normal.set(0, 0, 1).transformDirection(frame.matrixWorld);
      this.toCamera.subVectors(camera.position, this.worldPosition);
      const face = frame.element.firstElementChild;
      const transform = this.normal.dot(this.toCamera) < 0 ? 'rotateY(180deg)' : 'rotateY(0deg)';
      if (face && face.style.transform !== transform) face.style.transform = transform;
    });
  }

  destroy() {
    this.events.abort();
    gsap.killTweensOf(this);
    this.frames.forEach((frame) => {
      gsap.killTweensOf(frame.position);
      gsap.killTweensOf(frame.scale);
      frame.element.querySelectorAll('*').forEach((element) => gsap.killTweensOf(element));
      frame.element.remove();
    });
    this.ribbonSegments.forEach((segment) => segment.element.remove());
    this.frames.length = 0;
    this.ribbonSegments.length = 0;
    this.clear();
  }
}
