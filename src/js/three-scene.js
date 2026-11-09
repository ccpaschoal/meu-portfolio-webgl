import * as THREE from 'three';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';
import { FilmRing } from './film-ring.js';
import { ProjectorWall } from './projector-wall.js';
import { createPhysicalObject, resizePhysicalObject, setPhysicalOpacity } from './physical-object.js';

export class CinematicScene {
  constructor({ container, frames, portrait, vhs, sites }) {
    this.container = container;
    this.events = new AbortController();
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 7000);
    this.camera.position.set(0, 45, 2500);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new CSS3DRenderer();
    this.renderer.domElement.className = 'film-ring-renderer';
    this.renderer.domElement.style.overflow = 'clip';
    container.append(this.renderer.domElement);

    // Anel de filme com raio amplo de 820px para acomodar todos os carrosséis
    this.film = new FilmRing(frames, { radius: 820, height: 350, tilt: 0.15, reducedMotion: this.motionPreference.matches });
    this.filmRig = new THREE.Group();
    this.filmRig.add(this.film);
    this.scene.add(this.filmRig);

    this.wall = new ProjectorWall(sites);
    this.wallRig = new THREE.Group();
    this.wallRig.add(this.wall);
    this.scene.add(this.wallRig);

    this.photo = createPhysicalObject(portrait, { width: 360, height: 540, depth: 7, kind: 'photo', color: '#bcb4a3' });
    this.photoRig = new THREE.Group();
    this.photoRig.add(this.photo);
    this.photoRig.rotation.z = -0.045;
    this.scene.add(this.photoRig);

    this.vhs = createPhysicalObject(vhs, { width: Math.min(900, innerWidth - 40), height: 340, depth: 34, kind: 'vhs', color: '#171b18' });
    this.vhsRig = new THREE.Group();
    this.vhsRig.add(this.vhs);
    this.vhs.rotation.x = 0.06;
    this.scene.add(this.vhsRig);

    this.pose = {
      reelAlpha: 1, reelDepth: 0, reelRoll: 0,
      wallAlpha: 0, wallProgress: 0, wallDepth: -420, wallYaw: -0.15,
      photoAlpha: 0, vhsAlpha: 0, photoLift: 120, vhsLift: 140,
      photoReveal: 0, photoDepth: -650, vhsDepth: -500, phase: 0
    };
    this.pointer = { x: 0, y: 0 };
    this.pointerSmooth = { x: 0, y: 0 };
    this.baseCamera = { x: 0, y: 45, z: 1000 };
    this.glow = document.querySelector('#ambient-glow');
    this.destroyed = false;
    this.lastEnergy = -1;
    this.photoBounds = null;

    this.tiltX = gsap.quickTo(this.photo.rotation, 'x', { duration: 0.5, ease: 'power3.out' });
    this.tiltY = gsap.quickTo(this.photo.rotation, 'y', { duration: 0.5, ease: 'power3.out' });

    const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: this.events.signal });
    listen(window, 'resize', () => this.resize());
    listen(window, 'pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      this.pointer.x = event.clientX / innerWidth * 2 - 1;
      this.pointer.y = event.clientY / innerHeight * 2 - 1;
    });
    listen(this.motionPreference, 'change', (event) => {
      this.film.reducedMotion = event.matches;
      if (event.matches) { this.tiltX(0); this.tiltY(0); }
    });

    listen(portrait, 'pointerenter', () => { this.photoBounds = portrait.getBoundingClientRect(); });
    listen(portrait, 'pointermove', (event) => {
      if (this.motionPreference.matches || event.pointerType === 'touch' || this.pose.photoAlpha < 0.9) return;
      const bounds = this.photoBounds || portrait.getBoundingClientRect();
      const x = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
      const y = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);
      this.tiltX(-y * 0.25);
      this.tiltY(x * 0.25);
      gsap.to(portrait, {
        boxShadow: `${-x * 28 + 5}px ${25 - y * 24}px 50px rgba(0,0,0,0.6), 4px 6px 0 #aaa69b`,
        duration: 0.4,
        overwrite: 'auto'
      });
    });
    listen(portrait, 'pointerleave', () => {
      this.tiltX(0); this.tiltY(0);
      gsap.to(portrait, { boxShadow: '5px 25px 50px rgba(0,0,0,0.6), 4px 6px 0 #aaa69b', duration: 0.5, overwrite: 'auto' });
    });

    this.resize();
    this.render = this.render.bind(this);
    this.frameId = requestAnimationFrame(this.render);
  }

  resize() {
    this.width = Math.max(innerWidth, 1);
    this.height = Math.max(innerHeight, 1);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.render(this.scene, this.camera);

    const projection = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1000);

    const focalPixels = projection * 1000;
    const widthRatio = Math.max(1, this.width - 56) / (2 * focalPixels);
    const widthFit = widthRatio * 1000 / Math.sqrt(1 + widthRatio * widthRatio) / this.film.radius;
    const halfHeight = Math.max(80, (this.height - 300) / 2);
    const envelope = 350 / 2 + this.film.radius * Math.sin(0.15);
    const heightFit = halfHeight * 1000 / (focalPixels * envelope + halfHeight * this.film.radius);
    const ringScale = Math.max(0.08, Math.min(widthFit, heightFit * 0.78, 0.9));
    this.ringScale = ringScale;
    this.filmRig.scale.setScalar(ringScale);
    this.filmRig.position.y = -55 / projection;
    this.film.focusScale = this.width < 600 ? 1.65 : 1.04;

    const wasLocked = this.film.locked;
    const selected = this.film.activeIndex;
    this.film.activeIndex = -1;
    this.film.setActive(Math.max(0, selected), wasLocked);

    this.wall.setCompact(this.width < 700);
    const wallWidth = this.width < 700 ? 440 : 990;
    const wallHeight = this.width < 700 ? 310 : 680;
    const widthBudget = this.width - 48;
    const perspectiveWidthFit = widthBudget * 940 / (wallWidth * focalPixels + widthBudget * 70);
    this.wallScale = Math.max(0.15, Math.min(0.9, perspectiveWidthFit, (this.height - 380) / (wallHeight * projection)));
    this.wallRig.scale.setScalar(this.wallScale);
    this.wallRig.position.y = -75 / projection;

    const photoScale = Math.min(1, (this.width - 52) / (360 * projection), (this.height - 220) / (540 * projection));
    this.photoScale = Math.max(0.2, photoScale);
    this.photoRig.position.x = this.width >= 1000 ? Math.min(180, this.width * 0.16) / projection : 0;
    this.photoBaseY = -35 / projection;

    const vhsWidth = this.vhs.element.offsetWidth || Math.min(900, this.width - 40);
    const vhsHeight = this.vhs.element.offsetHeight || 320;
    const vhsScale = Math.min(1, (this.width - 48) / (vhsWidth * projection), (this.height - 230) / (vhsHeight * projection));
    this.vhsRig.scale.setScalar(Math.max(0.2, vhsScale));
    resizePhysicalObject(this.vhs, vhsWidth, vhsHeight);
    this.vhsBaseY = -65 / projection;
    this.photoBounds = null;

    this.applyPose(this.pose);
  }

  applyPose(pose) {
    this.pose = pose;
    this.film.setOpacity(pose.reelAlpha);
    this.filmRig.scale.setScalar(this.ringScale * (0.82 + 0.18 * pose.reelAlpha));
    this.filmRig.position.z = pose.reelDepth;
    this.wall.setState(pose.wallAlpha, pose.wallProgress);
    this.wallRig.position.z = pose.wallDepth;
    this.wallRig.rotation.y = pose.wallYaw;
    setPhysicalOpacity(this.photo, pose.photoAlpha);
    setPhysicalOpacity(this.vhs, pose.vhsAlpha);
    this.photo.element.inert = pose.photoAlpha < 0.5;
    this.vhs.element.inert = pose.vhsAlpha < 0.5;
    this.photo.element.setAttribute('aria-hidden', String(pose.photoAlpha < 0.5));
    this.vhs.element.setAttribute('aria-hidden', String(pose.vhsAlpha < 0.5));

    this.photoRig.position.y = this.photoBaseY - pose.photoLift;
    this.photoRig.position.z = pose.photoDepth;
    this.photoRig.scale.setScalar(this.photoScale * Math.max(0.001, pose.photoReveal));
    this.photoRig.rotation.z = -0.15 + pose.photoReveal * 0.105;
    this.photoRig.rotation.y = (1 - pose.photoReveal) * -0.4;

    this.vhsRig.position.y = this.vhsBaseY - pose.vhsLift;
    this.vhsRig.position.z = pose.vhsDepth;
    this.vhsRig.rotation.x = pose.vhsLift * 0.001;

    if (document.body.dataset.started === 'true') {
      this.baseCamera.x = this.wall.position.x * -pose.wallAlpha * 0.04;
      this.baseCamera.y = 45 - pose.vhsAlpha * 24;
      this.baseCamera.z = 1000 - pose.wallAlpha * 60;
    }

    const warm = [210, 150, 85];
    const paper = [183, 166, 138];
    const cool = [96, 149, 139];
    const weights = [pose.reelAlpha + pose.wallAlpha * 0.85, pose.photoAlpha, pose.vhsAlpha];
    const sum = Math.max(0.001, weights.reduce((a, b) => a + b, 0));
    const rgb = warm.map((value, channel) => Math.round((value * weights[0] + paper[channel] * weights[1] + cool[channel] * weights[2]) / sum));
    this.glow.style.setProperty('--glow-rgb', rgb.join(','));
  }

  render() {
    if (this.destroyed) return;
    this.frameId = requestAnimationFrame(this.render);
    if (document.hidden) return;
    if (document.body.dataset.started === 'true') {
      const movement = this.motionPreference.matches ? 0 : 1;
      this.pointerSmooth.x += (this.pointer.x * movement - this.pointerSmooth.x) * 0.045;
      this.pointerSmooth.y += (this.pointer.y * movement - this.pointerSmooth.y) * 0.045;
      this.camera.position.set(this.baseCamera.x + this.pointerSmooth.x * 10, this.baseCamera.y - this.pointerSmooth.y * 5, this.baseCamera.z);
      this.camera.lookAt(0, 0, 0);
      this.filmRig.rotation.z = this.pose.reelRoll;
      this.photoRig.rotation.z = -0.15 + this.pose.photoReveal * 0.105;
      this.vhsRig.rotation.z = 0;
    }
    if (this.pose.reelAlpha > 0.001) this.film.updateFaces(this.camera);

    const energy = this.pose.reelAlpha * this.film.energy + this.pose.wallAlpha * 0.32 + this.pose.photoAlpha * 0.32 + this.pose.vhsAlpha * 0.36;
    if (Math.abs(energy - this.lastEnergy) > 0.001) {
      this.glow.style.opacity = String(energy);
      this.lastEnergy = energy;
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.events.abort();
    this.tiltX.tween.kill(); this.tiltY.tween.kill();
    gsap.killTweensOf(this.photo.element);
    gsap.killTweensOf(this.camera.position);
    this.film.destroy();
    this.wall.destroy();
    this.scene.clear();
    this.renderer.domElement.remove();
  }
}
