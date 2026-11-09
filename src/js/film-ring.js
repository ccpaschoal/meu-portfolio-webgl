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
    this.morphProgress = 0;
    this.morphStartYaw = null;
    this.lastOpacity = -1;
    this.energy = 0.25;
    this.events = new AbortController();
    this.normal = new THREE.Vector3();
    this.worldPosition = new THREE.Vector3();
    this.toCamera = new THREE.Vector3();
    this.morphPosition = new THREE.Vector3();
    this.ribbonSegments = [];
    this.frames = [];
    this.sceneOpacity = 1;

    const count = elements.length;
    const step = Math.PI * 2 / count;
    const width = 2 * radius * Math.tan(step / 2) + 8;
    this.frameWidth = width;
    this.ribbon = new THREE.Group();
    this.ribbon.name = 'translucent-amber-film-with-sprockets';
    const segmentsPerFrame = 4;
    const segmentCount = count * segmentsPerFrame;
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
        object.userData.ringPosition = object.position.clone();
        object.userData.ringRotation = object.rotation.clone();
        object.userData.pathT = (index + 0.5) / segmentCount;
        object.userData.pathPosition = this.curvePoint(object.userData.pathT);
        object.userData.pathPosition.y += edge * (height / 2 - 10);
        const tangent = this.curveTangent(object.userData.pathT);
        object.userData.pathRotation = new THREE.Euler(0, Math.atan2(-tangent.z, tangent.x), 0);
        object.userData.ringQuaternion = new THREE.Quaternion().setFromEuler(object.userData.ringRotation);
        object.userData.pathQuaternion = new THREE.Quaternion().setFromEuler(object.userData.pathRotation);
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
      frame.userData.ringPosition = frame.position.clone();
      frame.userData.base = frame.position.clone();
      frame.userData.ringRotation = frame.rotation.clone();
      const pathT = (index + 0.5) / count;
      frame.userData.pathPosition = this.curvePoint(pathT);
      const pathTangent = this.curveTangent(pathT);
      frame.userData.pathRotation = new THREE.Euler(0, Math.PI, Math.atan2(-pathTangent.y, pathTangent.x) * 0.08);
      frame.userData.gridPosition = new THREE.Vector3();
      frame.userData.gridRotation = new THREE.Euler(0, Math.PI, 0);
      frame.userData.ringQuaternion = new THREE.Quaternion().setFromEuler(frame.userData.ringRotation);
      frame.userData.pathQuaternion = new THREE.Quaternion().setFromEuler(frame.userData.pathRotation);
      frame.userData.gridQuaternion = new THREE.Quaternion().setFromEuler(frame.userData.gridRotation);
      frame.userData.angle = angle;
      frame.userData.index = index;
      this.add(frame);
      this.frames.push(frame);

      const lens = (focused) => {
        if (this.activeIndex !== index || !this.locked) return;
        frameElement.classList.toggle('is-focused', focused);
        gsap.to(element, {
          filter: focused ? 'blur(0px) contrast(1.08) brightness(1.04)' : 'blur(0px) contrast(.84) brightness(.76)',
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

    this.refreshGridLayout();
    this.setActive(0, true);
  }

  curvePoint(progress) {
    if (!this.previewCurve) {
      this.previewCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-790, -130, -80),
        new THREE.Vector3(-610, 135, -190),
        new THREE.Vector3(-380, 205, -285),
        new THREE.Vector3(-115, 105, -150),
        new THREE.Vector3(145, -140, -270),
        new THREE.Vector3(410, -185, -105),
        new THREE.Vector3(640, 25, -215),
        new THREE.Vector3(800, 155, -90),
      ], false, 'centripetal');
      this.previewCurve.arcLengthDivisions = 300;
    }
    return this.previewCurve.getPointAt(THREE.MathUtils.clamp(progress, 0, 1));
  }

  curveTangent(progress) {
    if (!this.previewCurve) this.curvePoint(0);
    return this.previewCurve.getTangentAt(THREE.MathUtils.clamp(progress, 0, 1)).normalize();
  }

  refreshGridLayout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (this.gridWidth === width && this.gridHeight === height) return;
    this.gridWidth = width;
    this.gridHeight = height;
    const columns = width < 520 ? 2 : width < 800 ? 3 : 4;
    const rows = Math.ceil(this.frames.length / columns);
    const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(42 / 2)) * (1100 - 180);
    const worldWidth = worldHeight * width / height;
    const verticalGaps = Math.max(0, rows - 1) * 16;
    const horizontalGaps = Math.max(0, columns - 1) * 20;
    const heightScale = (worldHeight * 0.78 - verticalGaps) / (rows * this.height);
    const widthScale = (worldWidth * 0.88 - horizontalGaps) / (columns * this.frameWidth);
    const gridScale = THREE.MathUtils.clamp(Math.min(heightScale, widthScale), 0.34, 0.82);
    const stepX = this.frameWidth * gridScale + 20;
    const stepY = this.height * gridScale + 16;
    this.frames.forEach((frame, index) => {
      const row = Math.floor(index / columns);
      const rowLength = row === rows - 1 ? this.frames.length - row * columns : columns;
      const column = index % columns + (columns - rowLength) / 2;
      frame.userData.gridPosition.set(
        (column - (columns - 1) / 2) * stepX,
        ((rows - 1) / 2 - row) * stepY,
        -180,
      );
      frame.userData.gridScale = gridScale;
    });
  }

  setMorph(progress) {
    this.refreshGridLayout();
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    if (progress > 0 && this.morphStartYaw === null) this.morphStartYaw = this.rotation.y;
    this.morphProgress = progress;

    if (progress <= 0.001) {
      this.frames.forEach((frame) => {
        frame.position.copy(frame.userData.ringPosition);
        frame.rotation.copy(frame.userData.ringRotation);
        frame.scale.setScalar(1);
      });
      this.ribbonSegments.forEach((segment) => {
        segment.position.copy(segment.userData.ringPosition);
        segment.rotation.copy(segment.userData.ringRotation);
        segment.element.style.opacity = String(this.sceneOpacity);
      });
      return;
    }

    const reelToCurve = THREE.MathUtils.smoothstep(progress, 0.03, 0.55);
    const curveToGrid = THREE.MathUtils.smoothstep(progress, 0.52, 1);
    const yaw = this.morphStartYaw ?? Math.PI;
    this.rotation.y = THREE.MathUtils.lerp(yaw, Math.PI, THREE.MathUtils.smoothstep(progress, 0.02, 0.9));
    this.rotation.x = THREE.MathUtils.lerp(0.15, 0.05, progress);

    this.frames.forEach((frame) => {
      const { ringPosition, pathPosition, gridPosition } = frame.userData;
      frame.position.copy(ringPosition).lerp(pathPosition, reelToCurve).lerp(gridPosition, curveToGrid);
      frame.quaternion.copy(frame.userData.ringQuaternion).slerp(frame.userData.pathQuaternion, reelToCurve).slerp(frame.userData.gridQuaternion, curveToGrid);
      const scale = THREE.MathUtils.lerp(1, THREE.MathUtils.lerp(0.82, frame.userData.gridScale, curveToGrid), reelToCurve);
      frame.scale.setScalar(scale);
      frame.element.classList.toggle('is-active', progress > 0.48);
      if (frame.element.classList.contains('is-locked')) frame.element.classList.remove('is-locked');
    });

    this.ribbonSegments.forEach((segment) => {
      const { ringPosition, pathPosition, ringQuaternion, pathQuaternion } = segment.userData;
      this.morphPosition.copy(ringPosition).lerp(pathPosition, reelToCurve);
      segment.position.copy(this.morphPosition);
      segment.quaternion.copy(ringQuaternion).slerp(pathQuaternion, reelToCurve);
      const opacity = this.sceneOpacity * (1 - curveToGrid);
      if (Math.abs(opacity - (segment.userData.lastOpacity ?? -1)) > 0.015) {
        segment.element.style.opacity = String(opacity);
        segment.userData.lastOpacity = opacity;
      }
    });

    if (progress === 0) {
      this.morphStartYaw = null;
      this.rotation.x = 0.15;
      this.frames.forEach((frame) => {
      const selected = frame.userData.index === this.activeIndex;
        frame.element.classList.toggle('is-active', selected);
        frame.element.classList.toggle('is-locked', selected && this.locked);
      });
    }
  }

  setActive(index, locked = false) {
    if (this.morphProgress > 0.02) return;
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
      const base = frame.userData.ringPosition;
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
    this.sceneOpacity = value;
    this.frames.forEach((frame) => {
      frame.element.style.opacity = String(value);
      frame.element.inert = value < 0.05;
      frame.element.setAttribute('aria-hidden', String(value < 0.05));
    });
    const bandOpacity = value * (1 - THREE.MathUtils.smoothstep(this.morphProgress, 0.52, 1));
    this.ribbonSegments.forEach((ribbon) => {
      ribbon.element.style.opacity = String(bandOpacity);
      ribbon.userData.lastOpacity = bandOpacity;
    });
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
