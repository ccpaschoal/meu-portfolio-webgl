import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

export class ProjectorWall extends THREE.Group {
  constructor(elements) {
    super();
    this.name = 'website-projectors';
    this.activeIndex = -1;
    this.panels = elements.map((element, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const panel = new CSS3DObject(element);
      panel.position.set((column - 0.5) * 490, (0.5 - row) * 330, column ? 20 : -20);
      panel.rotation.y = column ? -0.12 : 0.12;
      this.add(panel);
      return panel;
    });
  }

  setState(opacity, progress) {
    const index = Math.min(this.panels.length - 1, Math.floor(progress * this.panels.length));
    const changed = index !== this.activeIndex || this.needsLayout;
    this.panels.forEach((panel, position) => {
      const active = position === index;
      panel.element.style.opacity = String(opacity * (this.compact && !active ? 0.15 : 1));
      panel.element.inert = opacity < 0.5;
      panel.element.setAttribute('aria-hidden', String(opacity < 0.5));
      panel.element.classList.toggle('is-projected', active);
      if (changed) {
        gsap.to(panel.position, { z: active ? 70 : -24, duration: 0.6, ease: 'power3.out', overwrite: true });
        gsap.to(panel.rotation, { y: active || this.compact ? 0 : position % 2 ? -0.15 : 0.15, duration: 0.6, ease: 'power3.out', overwrite: true });
      }
    });
    this.activeIndex = index;
    const target = this.panels[index];
    // A restrained pan keeps all four independent screens in view.
    if (changed) gsap.to(this.position, {
      x: -target.position.x * (this.compact ? 1 : 0.08),
      y: this.compact ? 0 : -target.position.y * 0.08,
      duration: 0.6, ease: 'power3.out', overwrite: true,
    });
    this.needsLayout = false;
  }

  setCompact(compact) {
    this.needsLayout = this.compact !== compact;
    this.compact = compact;
    this.panels.forEach((panel, index) => {
      panel.position.x = compact ? index * 490 : (index % 2 - 0.5) * 490;
      panel.position.y = compact ? 0 : (0.5 - Math.floor(index / 2)) * 330;
      panel.rotation.y = compact ? 0 : index % 2 ? -0.12 : 0.12;
    });
  }

  destroy() {
    gsap.killTweensOf(this.position);
    this.panels.forEach((panel) => { gsap.killTweensOf(panel.position); gsap.killTweensOf(panel.rotation); panel.element.remove(); });
    this.clear();
  }
}
