import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

/**
 * Fase 3: Parede de Projetores / Mockups Físicos de Celulares 3D
 * Exibe os 4 sites desenvolvidos em smartphones 3D com volume,
 * enquadramento perfeito das imagens e rotação livre (3D Drag).
 */
export class ProjectorWall extends THREE.Group {
  constructor(elements) {
    super();
    this.name = 'website-projectors';
    this.activeIndex = -1;
    this.compact = false;
    this.needsLayout = false;
    this.events = new AbortController();

    this.panels = elements.map((element, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);

      // Envolve cada elemento num mockup 3D com volume e detalhes de smartphone
      element.classList.add('phone-mockup-3d');
      element.style.transformStyle = 'preserve-3d';

      // Cria a estrutura visual de smartphone com notch e brilho especular se não existir
      if (!element.querySelector('.phone-notch-bar')) {
        const notch = document.createElement('div');
        notch.className = 'phone-notch-bar';
        notch.innerHTML = '<span class="phone-lens"></span><span class="phone-mic"></span>';
        notch.setAttribute('aria-hidden', 'true');
        element.prepend(notch);
      }

      if (!element.querySelector('.phone-specular-glare')) {
        const glare = document.createElement('div');
        glare.className = 'phone-specular-glare';
        glare.setAttribute('aria-hidden', 'true');
        element.append(glare);
      }

      const panel = new CSS3DObject(element);
      panel.position.set((column - 0.5) * 490, (0.5 - row) * 330, column ? 20 : -20);
      panel.rotation.y = column ? -0.12 : 0.12;
      panel.userData.baseRotY = panel.rotation.y;
      this.add(panel);

      // Rotação 3D interativa individual (Drag 3D no celular)
      this.attachPhoneDrag(element, panel);

      return panel;
    });
  }

  attachPhoneDrag(element, panel) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let rotX = 0;
    let rotY = 0;

    const signal = this.events.signal;
    const glare = element.querySelector('.phone-specular-glare');

    const updateTransform = () => {
      element.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      if (glare) {
        const gx = 50 + rotY * 1.5;
        const gy = 50 + rotX * 1.5;
        glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.18) 0%, transparent 65%)`;
      }
    };

    element.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      element.setPointerCapture?.(e.pointerId);
      gsap.killTweensOf(element);
    }, { signal });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      rotY = Math.max(-35, Math.min(35, rotY + dx * 0.35));
      rotX = Math.max(-25, Math.min(25, rotX - dy * 0.35));
      updateTransform();
    }, { signal });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      if (e?.pointerId && element.hasPointerCapture?.(e.pointerId)) {
        element.releasePointerCapture(e.pointerId);
      }
      // Retorna suavemente para a posição frontal de descanso
      const target = { x: rotX, y: rotY };
      gsap.to(target, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'back.out(1.4)',
        onUpdate: () => {
          rotX = target.x;
          rotY = target.y;
          updateTransform();
        }
      });
    };

    window.addEventListener('pointerup', endDrag, { signal });
    window.addEventListener('pointercancel', endDrag, { signal });
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
        gsap.to(panel.position, {
          z: active ? 70 : -24,
          duration: 0.6,
          ease: 'power3.out',
          overwrite: true
        });
        gsap.to(panel.rotation, {
          y: active || this.compact ? 0 : position % 2 ? -0.15 : 0.15,
          duration: 0.6,
          ease: 'power3.out',
          overwrite: true
        });
      }
    });

    this.activeIndex = index;
    const target = this.panels[index];
    if (changed && target) {
      gsap.to(this.position, {
        x: -target.position.x * (this.compact ? 1 : 0.08),
        y: this.compact ? 0 : -target.position.y * 0.08,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
      });
    }
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
    this.events.abort();
    gsap.killTweensOf(this.position);
    this.panels.forEach((panel) => {
      gsap.killTweensOf(panel.position);
      gsap.killTweensOf(panel.rotation);
      panel.element.remove();
    });
    this.clear();
  }
}
