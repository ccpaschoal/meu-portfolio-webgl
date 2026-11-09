import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Page scroll changes chapters only. Reel rotation is owned by autoplay and pointer drag. */
export class CinematicStory {
  constructor(scene) {
    this.scene = scene;
    this.events = new AbortController();
    this.motion = prefersReducedMotion;
    this.count = scene.film.frames.length;
    this.stepAngle = Math.PI * 2 / this.count;
    this.snapAngle = gsap.utils.snap(this.stepAngle);
    this.suspended = false;
    this.dragging = false;
    this.hoveringReel = false;
    this.navigating = false;
    this.playing = !this.motion.matches;
    this.autoRunning = false;
    this.pointer = null;
    this.suppressClickUntil = 0;
    this.playButton = document.querySelector('#reel-play-toggle');
    this.transport = document.querySelector('#project-transport');
    this.copies = [...document.querySelectorAll('[data-copy]')];
    this.nav = [...document.querySelectorAll('.site-header [data-chapter]')];
    this.progressBar = document.querySelector('.story-progress > span');
    this.positionReadout = document.querySelector('#project-position');
    this.titleReadout = document.querySelector('#project-title');
    this.chapterReadout = document.querySelector('#chapter-position');
    this.cue = document.querySelector('#story-cue');
    this.clock = { progress: 0 };
    this.lastClock = 0;

    this.context = gsap.context(() => {
      this.autoTween = gsap.to(this.clock, {
        progress: 1, duration: 38, ease: 'none', repeat: -1, paused: true,
        onUpdate: () => {
          let delta = this.clock.progress - this.lastClock;
          if (delta < -0.5) delta += 1;
          this.lastClock = this.clock.progress;
          scene.film.rotation.y -= delta * Math.PI * 2;
          this.updateFromAngle();
        },
      });
      this.state = {
        reelAlpha: 1, reelDepth: 0, reelRoll: 0, reelMorph: 0,
        wallAlpha: 0, wallProgress: 0, wallDepth: -420, wallYaw: -0.15,
        photoAlpha: 0, photoLift: 120, photoReveal: 0, photoDepth: -650,
        vhsAlpha: 0, vhsLift: 140, vhsDepth: -500, phase: 0,
      };
      this.timeline = gsap.timeline({
        onUpdate: () => this.applyState(),
        scrollTrigger: {
          trigger: '#story-scroll', start: 'top top', end: 'bottom bottom',
          scrub: this.motion.matches ? true : 0.45, invalidateOnRefresh: true,
        },
      });
      this.timeline
        .to(this.state, { phase: 1, duration: 1, ease: 'none' }, 0)
        .to(this.state, { reelMorph: 1, duration: 0.38, ease: 'none' }, 0.02)
        .to(this.state, { reelAlpha: 0, reelDepth: -400, reelRoll: -0.12, duration: 0.1, ease: 'power1.inOut' }, 0.5)
        .to(this.state, { wallAlpha: 1, wallDepth: 0, wallYaw: 0, duration: 0.09, ease: 'power1.out' }, 0.55)
        .to(this.state, { wallProgress: 1, duration: 0.2, ease: 'none' }, 0.6)
        .to(this.state, { wallAlpha: 0, wallDepth: -360, wallYaw: 0.12, duration: 0.08, ease: 'power1.in' }, 0.78)
        .to(this.state, { photoAlpha: 1, photoReveal: 1, photoLift: 0, photoDepth: 0, duration: 0.08, ease: 'power2.out' }, 0.82)
        .to(this.state, { photoAlpha: 0, photoLift: -90, photoDepth: -260, duration: 0.07, ease: 'power1.in' }, 0.92)
        .to(this.state, { vhsAlpha: 1, vhsLift: 0, vhsDepth: 0, duration: 0.1, ease: 'power2.out' }, 0.95);
    });

    const listen = (target, type, callback, options = {}) => target?.addEventListener(type, callback, { ...options, signal: this.events.signal });
    listen(this.playButton, 'click', () => this.setPlaying(!this.playing));
    listen(scene.container, 'pointerover', (event) => {
      if (event.target.closest?.('.film-ring-frame')) { this.hoveringReel = true; this.syncAuto(); }
    });
    listen(scene.container, 'pointerout', (event) => {
      if (!event.relatedTarget?.closest?.('.film-ring-frame')) { this.hoveringReel = false; this.syncAuto(); }
    });
    listen(scene.container, 'pointerdown', (event) => {
      if (this.suspended || this.state.phase > 0.02 || event.button !== 0 || event.target.closest?.('button, a') || !event.target.closest?.('.film-ring-frame')) return;
      this.stopAutoImmediately();
      this.turnTween?.kill();
      this.turnTween = null;
      this.pointer = {
        id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY,
        lastX: event.clientX, time: performance.now(), angle: scene.film.rotation.y, velocity: 0, moved: false,
      };
      scene.container.setPointerCapture?.(event.pointerId);
    });
    listen(window, 'pointermove', (event) => {
      const pointer = this.pointer;
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && pointer.type === 'touch' && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        this.pointer = null;
        this.syncAuto();
        return;
      }
      if (!pointer.moved && Math.abs(dx) < 5) return;
      pointer.moved = true;
      this.dragging = true;
      scene.container.dataset.dragging = 'true';
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      pointer.velocity = (event.clientX - pointer.lastX) / Math.max(8, now - pointer.time);
      pointer.lastX = event.clientX;
      pointer.time = now;
      scene.film.rotation.y = pointer.angle + dx * 0.0065;
      this.updateFromAngle();
    }, { passive: false });
    const release = (event) => {
      const pointer = this.pointer;
      if (!pointer || event.pointerId !== pointer.id) return;
      this.pointer = null;
      this.dragging = false;
      delete scene.container.dataset.dragging;
      if (pointer.moved) {
        this.suppressClickUntil = performance.now() + 350;
        const momentum = gsap.utils.clamp(-0.42, 0.42, pointer.velocity * 0.12);
        this.selectAngle(scene.film.rotation.y + momentum);
      } else this.syncAuto();
    };
    listen(window, 'pointerup', release);
    listen(window, 'pointercancel', release);
    listen(document, 'visibilitychange', () => this.syncAuto());
    listen(this.motion, 'change', () => {
      if (this.motion.matches) this.setPlaying(false);
      this.timeline.scrollTrigger.vars.scrub = this.motion.matches ? true : 0.45;
      this.timeline.scrollTrigger.refresh();
    });
    listen(window, 'keydown', (event) => {
      if (this.suspended || this.state.phase > 0.02 || event.target.closest?.('button, a, input, textarea')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        this.step(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    this.updateFromAngle();
    this.applyState();
    this.setPlaying(this.playing);
  }

  stopAutoImmediately() {
    this.autoTween.pause();
    gsap.killTweensOf(this.autoTween);
    this.autoTween.timeScale(0);
    this.autoRunning = false;
  }

  syncAuto() {
    const running = this.playing && !this.suspended && !this.dragging && !this.pointer && !this.hoveringReel && !this.navigating && !this.turnTween?.isActive() && !document.hidden && !this.motion.matches && this.state.phase < 0.02;
    if (running === this.autoRunning) return;
    this.autoRunning = running;
    gsap.killTweensOf(this.autoTween);
    if (running) {
      this.autoTween.play();
      gsap.to(this.autoTween, { timeScale: 1, duration: 0.4, ease: 'sine.inOut', overwrite: true });
    } else {
      gsap.to(this.autoTween, {
        timeScale: 0, duration: 0.2, ease: 'power2.out', overwrite: true,
        onComplete: () => { if (!this.autoRunning) this.autoTween.pause(); },
      });
    }
  }

  setPlaying(value) {
    this.playing = Boolean(value) && !this.motion.matches;
    if (!this.playButton) return;
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    this.playButton.setAttribute('aria-label', this.playing ? 'Pausar giro da fita' : 'Reproduzir giro da fita');
    this.playButton.textContent = this.playing ? 'Ⅱ' : '▶';
    this.syncAuto();
  }

  updateFromAngle() {
    const turns = (Math.PI - this.scene.film.rotation.y) / this.stepAngle;
    const nearest = Math.round(turns);
    const index = ((nearest % this.count) + this.count) % this.count;
    const locked = !this.dragging && !this.turnTween?.isActive() && Math.abs(turns - nearest) < 0.19;
    this.scene.film.setActive(index, locked);
    if (this.positionReadout) this.positionReadout.textContent = `${String(index + 1).padStart(2, '0')} / ${this.count}`;
    if (this.titleReadout) this.titleReadout.textContent = this.scene.film.frames[index].element.querySelector('.card-name')?.textContent ?? '';
  }

  selectAngle(angle) {
    const target = Math.PI + this.snapAngle(angle - Math.PI);
    const index = ((Math.round((Math.PI - target) / this.stepAngle) % this.count) + this.count) % this.count;
    this.goToFrame(index, true);
  }

  goToFrame(index, animate = true) {
    if (this.suspended) return;
    index = ((index % this.count) + this.count) % this.count;
    this.stopAutoImmediately();
    this.turnTween?.kill();
    const current = this.scene.film.rotation.y;
    const base = Math.PI - index * this.stepAngle;
    const target = base + Math.round((current - base) / (Math.PI * 2)) * Math.PI * 2;
    this.scene.film.setActive(this.scene.film.activeIndex, false);
    this.turnTween = gsap.to(this.scene.film.rotation, {
      y: target, duration: animate && !this.motion.matches ? 0.62 : 0,
      ease: 'back.out(1.05)', overwrite: 'auto',
      onUpdate: () => this.updateFromAngle(),
      onComplete: () => { this.turnTween = null; this.updateFromAngle(); this.syncAuto(); },
    });
  }

  step(direction) { this.goToFrame(this.scene.film.activeIndex + direction); }

  applyState() {
    this.scene.applyPose(this.state);
    const phase = this.state.phase;
    const chapter = phase < 0.48 ? 'projects' : phase < 0.75 ? 'sites' : phase < 0.93 ? 'about' : 'contact';
    document.body.dataset.chapter = chapter;
    this.copies.forEach((copy) => copy.setAttribute('aria-hidden', String(copy.dataset.copy !== chapter)));
    this.nav.forEach((link) => {
      if (link.dataset.chapter === chapter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (this.transport) {
      this.transport.inert = chapter !== 'projects';
      this.transport.classList.toggle('is-hidden', chapter !== 'projects');
    }
    if (this.progressBar) this.progressBar.style.transform = `scaleX(${phase})`;
    const number = { projects: '01', sites: '02', about: '03', contact: '04' }[chapter];
    if (this.chapterReadout) this.chapterReadout.textContent = `${number} — 04`;
    if (this.cue) this.cue.textContent = { projects: 'Gira sozinha · passe o mouse ou arraste', sites: 'Role para explorar os sites', about: 'Mova o mouse sobre a foto', contact: 'Sua próxima ideia começa aqui' }[chapter];
    this.syncAuto();
  }

  goToChapter(chapter, animate = false) {
    const fraction = { projects: 0, sites: 0.6, about: 0.82, contact: 1 }[chapter];
    if (fraction === undefined) return;
    this.pointer = null;
    this.dragging = false;
    delete this.scene.container.dataset.dragging;
    this.navigating = true;
    this.syncAuto();
    this.navigationTween?.kill();
    this.turnTween?.kill();
    this.turnTween = null;
    const trigger = this.timeline.scrollTrigger;
    const target = trigger.start + (trigger.end - trigger.start) * fraction;
    const finish = () => { this.navigating = false; this.syncAuto(); };
    if (!animate || this.motion.matches) {
      window.scrollTo({ top: target, behavior: 'instant' });
      ScrollTrigger.update();
      finish();
      return;
    }
    const driver = { y: window.scrollY };
    this.navigationTween = gsap.to(driver, {
      y: target, duration: 0.85, ease: 'power3.inOut',
      onUpdate: () => { window.scrollTo(0, driver.y); ScrollTrigger.update(); },
      onComplete: finish,
    });
  }

  suspend() {
    this.suspended = true;
    this.pointer = null;
    this.dragging = false;
    this.turnTween?.kill();
    this.turnTween = null;
    this.navigationTween?.kill();
    this.navigating = false;
    this.stopAutoImmediately();
    this.timeline.scrollTrigger.disable(false);
  }

  resume() {
    this.suspended = false;
    this.timeline.scrollTrigger.enable(false, false);
    ScrollTrigger.update();
    this.syncAuto();
  }

  destroy() {
    this.events.abort();
    this.turnTween?.kill();
    this.navigationTween?.kill();
    this.autoTween?.kill();
    this.context.revert();
  }
}

/** Start RAF rendering and fly from the intro distance without linking reel rotation to page scroll. */
export function playIntroduction(scene, onComplete) {
  const reduced = prefersReducedMotion.matches;
  scene.renderReady = true;
  scene.camera.position.z = 2500;
  scene.camera.lookAt(0, 0, 0);
  const duration = reduced ? 0 : 2.25;
  return gsap.timeline({
    onComplete: () => {
      scene.camera.position.z = 1100;
      scene.camera.lookAt(0, 0, 0);
      onComplete?.();
    },
  })
    .to('#preloader', { autoAlpha: 0, duration: reduced ? 0 : 0.65, ease: 'power2.inOut' }, 0)
    .fromTo(scene.filmRig.rotation, { y: 0.16, z: -0.04 }, { y: 0, z: 0, duration, ease: 'power4.inOut' }, 0)
    .to(scene.camera.position, { z: 1100, duration, ease: 'power4.inOut', onUpdate: () => scene.camera.lookAt(0, 0, 0) }, reduced ? 0 : 0.12);
}
