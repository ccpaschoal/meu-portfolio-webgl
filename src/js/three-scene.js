import * as THREE from 'three';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';
import { FilmRing } from './film-ring.js';
import { ProjectorWall } from './projector-wall.js';
import { createPhysicalObject, resizePhysicalObject, setPhysicalOpacity } from './physical-object.js';

const clampSize = (value) => Math.max(1, Math.floor(value));

export class CinematicScene {
  constructor({ container, frames, portrait, vhs, sites }) {
    this.container = container;
    this.previousOverflow = {
      root: document.documentElement.style.overflowX,
      body: document.body.style.overflowX,
    };
    document.documentElement.style.overflowX = 'clip';
    document.body.style.overflowX = 'clip';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 5000);
    this.baseCamera = new THREE.Vector3(0, 0, 1000);
    this.camera.position.set(0, 0, 2500);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new CSS3DRenderer();
    this.renderer.setSize(clampSize(window.innerWidth), clampSize(window.innerHeight));
    this.renderer.domElement.className = 'film-ring-renderer cinematic-css3d-renderer';
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      overflow: 'clip', pointerEvents: 'none',
    });
    Object.assign(container.style, {
      position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      overflow: 'clip', pointerEvents: 'none',
    });
    container.replaceChildren(this.renderer.domElement);

    this.filmRig = new THREE.Group();
    this.filmRig.name = 'film-reel-rig';
    this.film = new FilmRing(frames, { radius: 820, height: 360, tilt: 0.15 });
    this.filmRig.add(this.film);
    this.scene.add(this.filmRig);

    this.wallRig = new THREE.Group();
    this.wallRig.name = 'projector-wall-rig';
    sites.forEach((site) => { site.style.pointerEvents = 'auto'; });
    this.wall = new ProjectorWall(sites);
    this.wallRig.add(this.wall);
    this.scene.add(this.wallRig);

    this.photoRig = new THREE.Group();
    this.photoRig.name = 'physical-photo-rig';
    this.photo = createPhysicalObject(portrait, { width: 380, height: 510, depth: 16, kind: 'photo', color: '#f4f0e6' });
    this.photoRig.add(this.photo);
    this.scene.add(this.photoRig);

    this.vhsRig = new THREE.Group();
    this.vhsRig.name = 'vhs-contact-rig';
    this.vhs = createPhysicalObject(vhs, { width: 820, height: 330, depth: 48, kind: 'vhs', color: '#161a1e' });
    this.vhsRig.add(this.vhs);
    this.scene.add(this.vhsRig);

    // Inclinação 3D no Three.js do objeto físico da foto (Polaroid Tilt)
    this.tiltX = gsap.quickTo(this.photo.rotation, 'x', { duration: 0.5, ease: 'power3.out' });
    this.tiltY = gsap.quickTo(this.photo.rotation, 'y', { duration: 0.5, ease: 'power3.out' });

    let photoBounds = null;
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    portrait.addEventListener('pointerenter', () => {
      photoBounds = portrait.getBoundingClientRect();
    });
    portrait.addEventListener('pointermove', (event) => {
      if (motionPreference.matches || event.pointerType === 'touch') return;
      const bounds = photoBounds || portrait.getBoundingClientRect();
      const x = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
      const y = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);
      this.tiltX(-y * 0.28);
      this.tiltY(x * 0.28);
    });
    portrait.addEventListener('pointerleave', () => {
      this.tiltX(0);
      this.tiltY(0);
      photoBounds = null;
    });

    this.pose = {
      reelAlpha: 1, reelDepth: 0, reelRoll: 0, reelMorph: 0,
      wallAlpha: 0, wallProgress: 0, wallDepth: -420, wallYaw: -0.15,
      photoAlpha: 0, photoLift: 120, photoReveal: 0, photoDepth: -650,
      vhsAlpha: 0, vhsLift: 140, vhsDepth: -500, phase: 0,
    };
    this.renderReady = true;
    this.disposed = false;
    this.frameRequest = 0;
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    this.resize();
    this.frameRequest = requestAnimationFrame(this.render);
  }

  resize() {
    if (this.disposed) return;
    const width = clampSize(window.innerWidth);
    const height = clampSize(window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.baseCamera.z;
    this.film.focusScale = THREE.MathUtils.clamp(visibleHeight / 900, 0.9, 1.06);
    this.film.refreshGridLayout();
    const narrowScale = THREE.MathUtils.clamp(Math.min(width / 1440, height / 920) * 0.82, 0.55, 0.82);
    this.filmRig.scale.setScalar(narrowScale);
    this.filmRig.position.y = 40;
    const photoScale = THREE.MathUtils.clamp(Math.min(width / 520, height / 750), 0.55, 1);
    this.photoRig.scale.setScalar(photoScale);
    const vhsScale = THREE.MathUtils.clamp(Math.min(width / 1100, height / 540), 0.55, 1);
    this.vhsRig.scale.setScalar(vhsScale);
    this.wall.setCompact(width < 760);
    this.renderer.render(this.scene, this.camera);
  }

  applyPose(pose) {
    this.pose = pose;
    this.filmRig.position.set(0, 0, pose.reelDepth || 0);
    this.filmRig.rotation.z = pose.reelRoll || 0;
    this.film.setMorph(pose.reelMorph || 0);
    this.film.setOpacity(pose.reelAlpha);
    this.wallRig.position.set(0, 0, pose.wallDepth || 0);
    this.wallRig.rotation.y = pose.wallYaw || 0;
    this.wall.setState(pose.wallAlpha, pose.wallProgress);
    this.photoRig.position.set(0, pose.photoLift || 0, pose.photoDepth || 0);
    this.photoRig.rotation.y = (1 - (pose.photoReveal || 0)) * -0.18;
    setPhysicalOpacity(this.photo, pose.photoAlpha);
    this.vhsRig.position.set(0, pose.vhsLift || 0, pose.vhsDepth || 0);
    setPhysicalOpacity(this.vhs, pose.vhsAlpha);
  }

  render() {
    if (this.disposed) return;
    if (!document.hidden && this.renderReady) {
      this.film.updateFaces(this.camera);
      this.renderer.render(this.scene, this.camera);
    }
    this.frameRequest = requestAnimationFrame(this.render);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameRequest);
    window.removeEventListener('resize', this.resize);
    this.tiltX?.tween?.kill();
    this.tiltY?.tween?.kill();
    this.film.destroy();
    this.wall.destroy();
    this.photo.traverse?.((object) => object.element?.remove());
    this.vhs.traverse?.((object) => object.element?.remove());
    this.renderer.domElement.remove();
    this.scene.clear();
    document.documentElement.style.overflowX = this.previousOverflow.root;
    document.body.style.overflowX = this.previousOverflow.body;
  }
}
