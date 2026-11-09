import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Continuous 35mm-style organic panoramic S-spline arc. CSS3DRenderer owns the wrapper matrices. */
export class FilmRing extends THREE.Group {
  constructor(elements, { radius = 1350, height = 340, tilt = 0.15 } = {}) {
    super();
    if (!Array.isArray(elements) || elements.length !== 10) {
      throw new RangeError('The film ring expects exactly ten carousel frames.');
    }
    this.name = 'panoramic-35mm-film-arc';
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

    // Track group ensures the panoramic arc maintains a stable, facing orientation in world space
    this.trackGroup = new THREE.Group();
    this.trackGroup.name = 'film-panoramic-track';
    this.add(this.trackGroup);

    // 1. Remodelação em Arco Panorâmico Aberto Elíptico (raio virtual expandido >= 1250px)
    // Curvatura suave que previne colisão euclidiana e clipping de bordas de cartões vizinhos
    // Centro frontal focal em Z = -480 (em mundo Z = +480 de frente para a câmera)
    this.splineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2200, 70, 780),
      new THREE.Vector3(1450, 40, 240),
      new THREE.Vector3(720, 15, -280),
      new THREE.Vector3(0, 0, -480),        // Centro focal frontal em destaque
      new THREE.Vector3(-720, -15, -280),
      new THREE.Vector3(-1450, -40, 240),
      new THREE.Vector3(-2200, -70, 780),
    ], false, 'catmullrom', 0.5);
    this.splineCurve.arcLengthDivisions = 400;

    const count = elements.length;
    const width = 540;
    this.frameWidth = width;
    this.ribbon = new THREE.Group();
    this.ribbon.name = 'translucent-amber-film-with-sprockets';
    const segmentsPerFrame = 4;
    const segmentCount = count * segmentsPerFrame; // 40 pares = 80 segmentos (>= 64)
    const segmentWidth = 140;

    // Fita Kodak Safety Film 35mm: Envelopa o fundo dos cartões em camada Z inferior (+55px atrás),
    // sem penetrar nem atravessar as superfícies das artes dos projetos.
    for (let index = 0; index < segmentCount; index += 1) {
      const tSeg = (index + 0.5) / segmentCount;
      const posSeg = this.splineCurve.getPointAt(tSeg);
      const tangentSeg = this.splineCurve.getTangentAt(tSeg).normalize();
      const angleY = Math.atan2(tangentSeg.z, -tangentSeg.x);
      const angleZ = Math.atan2(-tangentSeg.y, Math.hypot(tangentSeg.x, tangentSeg.z));

      for (const edge of [-1, 1]) {
        const strip = document.createElement('div');
        strip.className = 'film-ribbon-segment';
        strip.setAttribute('aria-hidden', 'true');
        strip.style.width = `${segmentWidth}px`;
        strip.style.pointerEvents = 'none';
        strip.style.zIndex = '5'; // Camada Z inferior aos cartões
        strip.style.background = 'linear-gradient(180deg, rgba(38, 22, 11, 0.76) 0%, rgba(18, 10, 4, 0.85) 100%)';
        strip.style.borderColor = 'rgba(222, 157, 73, 0.38)';
        strip.style.setProperty('--hole-offset', `${-index * segmentWidth}px`);
        const object = new CSS3DObject(strip);
        // posSeg.z + 55 situa a fita atrás da superfície dos cartões, contornando o fundo
        object.position.set(posSeg.x, posSeg.y + edge * (height / 2 + 18), posSeg.z + 55);
        object.rotation.set(0, angleY, angleZ * 0.35);
        object.userData.ringPosition = object.position.clone();
        object.userData.ringRotation = object.rotation.clone();
        object.userData.pathT = tSeg;
        object.userData.pathPosition = posSeg.clone();
        object.userData.pathPosition.y += edge * (height / 2 + 18);
        object.userData.pathPosition.z += 55;
        object.userData.pathRotation = object.rotation.clone();
        object.userData.ringQuaternion = new THREE.Quaternion().setFromEuler(object.userData.ringRotation);
        object.userData.pathQuaternion = new THREE.Quaternion().setFromEuler(object.userData.pathRotation);
        this.ribbon.add(object);
        this.ribbonSegments.push(object);
      }
    }
    this.trackGroup.add(this.ribbon);

    elements.forEach((element, index) => {
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
      frame.userData.ringPosition = new THREE.Vector3();
      frame.userData.base = new THREE.Vector3();
      frame.userData.ringRotation = new THREE.Euler();
      frame.userData.pathPosition = new THREE.Vector3();
      frame.userData.pathRotation = new THREE.Euler();
      frame.userData.gridPosition = new THREE.Vector3();
      frame.userData.gridRotation = new THREE.Euler(0, 0, 0);
      frame.userData.ringQuaternion = new THREE.Quaternion();
      frame.userData.pathQuaternion = new THREE.Quaternion();
      frame.userData.gridQuaternion = new THREE.Quaternion().setFromEuler(frame.userData.gridRotation);
      frame.userData.index = index;
      this.trackGroup.add(frame);
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
    this.updateSplineFlow();
    this.setActive(0, true);
  }

  curvePoint(progress) {
    if (!this.splineCurve) return new THREE.Vector3();
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    return this.splineCurve.getPointAt(t);
  }

  curveTangent(progress) {
    if (!this.splineCurve) return new THREE.Vector3(1, 0, 0);
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    return this.splineCurve.getTangentAt(t).normalize();
  }

  updateSplineFlow() {
    if (this.morphProgress > 0.05) return;

    // Estabiliza a orientação do arco panorâmico no espaço mundial (de frente para a câmera)
    this.trackGroup.rotation.y = -(this.rotation.y - Math.PI);

    const count = this.frames.length;
    const turns = (Math.PI - this.rotation.y) / ((Math.PI * 2) / count);
    const spread = 0.12;

    this.frames.forEach((frame, index) => {
      const relIndex = index - turns;
      const signedOffset = ((((relIndex + count / 2) % count) + count) % count) - count / 2;
      const dist = Math.abs(signedOffset);
      const t = THREE.MathUtils.clamp(0.5 + signedOffset * spread, 0.001, 0.999);

      const pos = this.splineCurve.getPointAt(t);
      const tangent = this.splineCurve.getTangentAt(t).normalize();
      const angleY = Math.atan2(tangent.z, -tangent.x);
      const angleZ = Math.atan2(-tangent.y, Math.hypot(tangent.x, tangent.z));
      const roll = tangent.z * 0.06;

      // Depth Stacking & Hierarquia Z Dinâmica:
      // Slide central ativo: escala 1.0, posição Z à frente em destaque, 100% de opacidade e pointer-events: auto.
      // Slides vizinhos laterais: recuo progressivo no eixo Z para trás (+Z local), escala reduzida (0.82 no primeiro, 0.65 nos seguintes) e fade (1.0 -> 0.5 -> 0.15).
      const zRecess = dist * 95;
      const isFocalActive = (index === this.activeIndex) && this.locked;
      const popZ = isFocalActive ? -30 : 0; // Traz o slide ativo à frente

      const scaleFactor = dist <= 1
        ? THREE.MathUtils.lerp(1.0, 0.82, dist)
        : THREE.MathUtils.lerp(0.82, 0.65, Math.min(1, dist - 1));
      const finalScale = (isFocalActive ? (this.focusScale || 1.035) : 1) * scaleFactor;

      const opacityFactor = dist <= 1
        ? THREE.MathUtils.lerp(1.0, 0.52, dist)
        : (dist <= 2
          ? THREE.MathUtils.lerp(0.52, 0.15, dist - 1)
          : THREE.MathUtils.lerp(0.15, 0.0, Math.min(1, (dist - 2) / 1.1)));

      frame.userData.ringPosition.set(pos.x, pos.y, pos.z + zRecess + popZ);
      frame.userData.ringRotation.set(roll, angleY, angleZ * 0.35);
      frame.userData.pathPosition.copy(frame.userData.ringPosition);
      frame.userData.pathRotation.copy(frame.userData.ringRotation);
      frame.userData.ringQuaternion.setFromEuler(frame.userData.ringRotation);
      frame.userData.pathQuaternion.copy(frame.userData.ringQuaternion);

      if (this.morphProgress <= 0.001) {
        frame.position.copy(frame.userData.ringPosition);
        frame.rotation.copy(frame.userData.ringRotation);
        frame.scale.setScalar(finalScale);

        // Hierarquia Z estrita (z-index DOM + pointer-events)
        frame.element.style.zIndex = String(Math.round(100 - dist * 20));
        frame.element.style.opacity = String(this.sceneOpacity * opacityFactor);
        frame.element.style.pointerEvents = (dist < 0.48 && opacityFactor > 0.4) ? 'auto' : 'none';
      }
    });

    // Fita Kodak Safety Film: perfurações rolam continuamente acompanhando a curvatura
    this.ribbonSegments.forEach((segment, segIdx) => {
      const segWidth = 140;
      const offset = (-segIdx * segWidth - turns * 80) % (40 * segWidth);
      segment.element.style.setProperty('--hole-offset', `${offset}px`);
    });
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
      this.updateSplineFlow();
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
    this.trackGroup.rotation.y = THREE.MathUtils.lerp(-(this.rotation.y - Math.PI), 0, curveToGrid);

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
    this.updateSplineFlow();

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
      if (selected && locked && frame.element.matches(':hover')) frame.userData.focusLens(true);
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
    this.updateSplineFlow();
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
