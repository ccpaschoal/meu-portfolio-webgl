import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

export class FilmRing extends THREE.Group {
  constructor(elements, { radius = 800, height = 340, tilt = 0.12, reducedMotion = false } = {}) {
    super();
    if (elements.length < 3 || !Number.isFinite(radius) || radius <= 0) throw new RangeError('At least three frames and a positive radius are required.');
    this.name = 'projector-ring';
    this.radius = radius;
    this.reducedMotion = reducedMotion;
    this.rotation.set(tilt, Math.PI, 0);
    this.activeIndex = -1;
    this.locked = false;
    this.lastOpacity = -1;
    this.energy = 0.3;
    this.events = new AbortController();
    this.normal = new THREE.Vector3();
    this.worldPosition = new THREE.Vector3();
    this.toCamera = new THREE.Vector3();

    const width = 2 * radius * Math.tan(Math.PI / elements.length) + 4;
    this.ribbon = new THREE.Group();
    this.ribbon.name = 'continuous-perforated-film';
    this.ribbonSegments = [];

    // Fita contínua de celulóide âmbar/marrom com perfurações 35mm
    const segments = 36;
    const bandRadius = radius + 1;
    const bandWidth = 2 * bandRadius * Math.tan(Math.PI / segments) + 2;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const band = document.createElement('div');
        band.className = 'film-ribbon-segment';
        band.setAttribute('aria-hidden', 'true');
        band.style.width = `${bandWidth}px`;
        band.style.setProperty('--hole-offset', `${-index * bandWidth}px`);
        const object = new CSS3DObject(band);
        object.position.set(-bandRadius * Math.sin(angle), side * (height / 2 - 12), -bandRadius * Math.cos(angle));
        object.rotation.y = angle;
        this.ribbon.add(object);
        this.ribbonSegments.push(object);
      }
    }
    this.add(this.ribbon);

    // Quadros de filme vintage marrom com marcações de película e carrossel
    this.frames = elements.map((element, index) => {
      const angle = (index / elements.length) * Math.PI * 2;
      const segment = document.createElement('div');
      segment.className = 'film-ring-frame';
      segment.style.cssText = `width:${width}px;height:${height}px`;
      segment.dataset.frame = String(index + 1).padStart(2, '0');

      const topEdge = document.createElement('div');
      topEdge.className = 'film-edge-mark film-edge-mark--top';
      topEdge.textContent = `▶ ${String(index + 1).padStart(2, '0')}A  KODAK SAFETY 400`;
      topEdge.setAttribute('aria-hidden', 'true');

      const bottomEdge = document.createElement('div');
      bottomEdge.className = 'film-edge-mark film-edge-mark--bottom';
      bottomEdge.textContent = `EASTMAN 5222  ★  ${String(index + 1).padStart(2, '0')}`;
      bottomEdge.setAttribute('aria-hidden', 'true');

      const face = document.createElement('div');
      face.className = 'film-ring-content';
      face.append(topEdge, element, bottomEdge);
      segment.append(face);

      const frame = new CSS3DObject(segment);
      frame.position.set(-radius * Math.sin(angle), 0, -radius * Math.cos(angle));
      frame.rotation.y = angle;
      frame.userData.base = frame.position.clone();
      this.add(frame);

      const surface = element;
      const lens = (focused) => {
        if (this.activeIndex !== index || !this.locked) return;
        gsap.to(surface, {
          filter: focused ? 'blur(0px) contrast(1.1) brightness(1.05)' : 'blur(0px) contrast(1)',
          duration: this.reducedMotion ? 0 : 0.4,
          overwrite: true
        });
        gsap.to(surface.querySelector('.frame-noise'), { opacity: focused ? 0 : 0.03, duration: 0.1, overwrite: true });
      };

      element.addEventListener('mouseenter', () => lens(true), { signal: this.events.signal });
      element.addEventListener('mouseleave', () => lens(false), { signal: this.events.signal });
      element.addEventListener('focusin', () => lens(true), { signal: this.events.signal });
      element.addEventListener('focusout', () => lens(false), { signal: this.events.signal });
      frame.userData.focusLens = lens;
      return frame;
    });

    this.setActive(0, true);
  }

  setActive(index, locked = false) {
    index = (index + this.frames.length) % this.frames.length;
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

      const factor = selected && locked && !this.reducedMotion ? 1.06 : 1;
      gsap.to(frame.position, {
        x: frame.userData.base.x * factor,
        z: frame.userData.base.z * factor,
        duration: this.reducedMotion ? 0 : 0.25,
        ease: locked ? 'back.out(1.2)' : 'power2.out',
        overwrite: true
      });
      gsap.to(frame.scale, {
        x: selected && locked ? (this.focusScale || 1.04) : 1,
        y: selected && locked ? (this.focusScale || 1.04) : 1,
        duration: this.reducedMotion ? 0 : 0.25,
        overwrite: true
      });
      if (selected && locked && card?.matches(':hover')) frame.userData.focusLens(true);
    });

    gsap.to(this, { energy: locked ? 0.75 : 0.25, duration: this.reducedMotion ? 0 : 0.2, overwrite: 'auto' });
  }

  setOpacity(value) {
    value = Math.max(0, Math.min(1, value));
    if (Math.abs(value - this.lastOpacity) < 0.001) return;
    this.lastOpacity = value;

    this.frames.forEach((frame) => {
      frame.element.style.opacity = String(value);
      frame.element.inert = value < 0.05;
      frame.element.setAttribute('aria-hidden', String(value < 0.05));
    });

    this.ribbonSegments.forEach((segment) => {
      segment.element.style.opacity = String(value * 0.95);
    });
  }

  updateFaces(camera) {
    this.updateMatrixWorld(true);
    this.frames.forEach((frame) => {
      frame.getWorldPosition(this.worldPosition);
      this.normal.set(0, 0, 1).transformDirection(frame.matrixWorld);
      this.toCamera.subVectors(camera.position, this.worldPosition);
      const transform = this.normal.dot(this.toCamera) < 0 ? 'rotateY(180deg)' : 'rotateY(0deg)';
      const face = frame.element.firstElementChild;
      if (face && face.style.transform !== transform) {
        face.style.transform = transform;
      }
    });
  }

  destroy() {
    this.events.abort();
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.rotation);
    this.frames.forEach((frame) => {
      gsap.killTweensOf(frame.position);
      gsap.killTweensOf(frame.scale);
      const card = frame.element.querySelector('.film-project-card');
      if (card) gsap.killTweensOf(card);
      const noise = frame.element.querySelector('.frame-noise');
      if (noise) gsap.killTweensOf(noise);
      frame.element.remove();
    });
    this.ribbonSegments.forEach((segment) => segment.element.remove());
    this.clear();
    this.frames.length = 0;
  }
}
