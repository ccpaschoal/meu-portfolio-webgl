import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';

/**
 * Fase 3: Mockups Físicos de Smartphones 3D Verticais (Sites Desenvolvidos)
 * Dispostos em uma elegante fileira panorâmica em arco 3D.
 * Chassis metálico chanfrado, entalhe de câmera / Dynamic Island,
 * prints mobile autênticos e rotação 3D interativa livre (Drag 3D).
 */
export class ProjectorWall extends THREE.Group {
  constructor(elements) {
    super();
    this.name = 'website-phone-mockups';
    this.activeIndex = -1;
    this.compact = false;
    this.needsLayout = false;
    this.events = new AbortController();

    const count = elements.length;

    this.panels = elements.map((element, index) => {
      element.classList.add('phone-mockup-3d');
      element.style.transformStyle = 'preserve-3d';

      // Cria entalhe Dynamic Island / notch no topo do smartphone
      if (!element.querySelector('.phone-notch-bar')) {
        const notch = document.createElement('div');
        notch.className = 'phone-notch-bar';
        notch.innerHTML = '<span class="phone-lens"></span><span class="phone-mic"></span>';
        notch.setAttribute('aria-hidden', 'true');
        element.prepend(notch);
      }

      // Reflexo de vidro especular reativo à inclinação
      if (!element.querySelector('.phone-specular-glare')) {
        const glare = document.createElement('div');
        glare.className = 'phone-specular-glare';
        glare.setAttribute('aria-hidden', 'true');
        element.append(glare);
      }

      const panel = new CSS3DObject(element);
      // Posição panorâmica em linha (lado a lado) com arco suave
      const offset = index - (count - 1) / 2; // -1.5, -0.5, 0.5, 1.5
      const baseX = offset * 290;
      const baseZ = -Math.abs(offset) * 28;
      const baseRotY = -offset * 0.08;

      panel.position.set(baseX, -10, baseZ);
      panel.rotation.set(0, baseRotY, 0);

      panel.userData.baseX = baseX;
      panel.userData.baseZ = baseZ;
      panel.userData.baseRotY = baseRotY;
      panel.userData.index = index;

      this.add(panel);

      // Rotação 3D interativa individual (Drag 3D) direto no CSS3DObject do Three.js
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
      panel.rotation.x = rotX;
      panel.rotation.y = panel.userData.baseRotY + rotY;
      if (glare) {
        const gx = 50 + THREE.MathUtils.radToDeg(rotY) * 1.5;
        const gy = 50 + THREE.MathUtils.radToDeg(rotX) * 1.5;
        glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.24) 0%, transparent 65%)`;
      }
    };

    element.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      element.setPointerCapture?.(e.pointerId);
      gsap.killTweensOf(panel.rotation);
    }, { signal });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      rotY = THREE.MathUtils.clamp(rotY + dx * 0.0035, -0.45, 0.45);
      rotX = THREE.MathUtils.clamp(rotX - dy * 0.0035, -0.35, 0.35);
      updateTransform();
    }, { signal });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      if (e?.pointerId && element.hasPointerCapture?.(e.pointerId)) {
        element.releasePointerCapture(e.pointerId);
      }
      // Retorna com rebote suave e elástico para a rotação base
      const target = { x: rotX, y: rotY };
      gsap.to(target, {
        x: 0,
        y: 0,
        duration: 0.65,
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
      panel.element.style.opacity = String(opacity * (this.compact && !active ? 0.2 : 1));
      panel.element.inert = opacity < 0.5;
      panel.element.setAttribute('aria-hidden', String(opacity < 0.5));
      panel.element.classList.toggle('is-projected', active);

      if (changed) {
        const targetZ = this.compact
          ? (active ? 60 : -40)
          : panel.userData.baseZ + (active ? 65 : 0);
        gsap.to(panel.position, {
          z: targetZ,
          duration: 0.55,
          ease: 'power3.out',
          overwrite: true
        });
      }
    });

    this.activeIndex = index;
    const target = this.panels[index];
    if (changed && target) {
      const targetX = this.compact
        ? -target.position.x
        : -target.position.x * 0.12;
      gsap.to(this.position, {
        x: targetX,
        duration: 0.55,
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
      if (compact) {
        panel.position.x = index * 300;
        panel.position.y = 0;
        panel.rotation.y = 0;
      } else {
        panel.position.x = panel.userData.baseX;
        panel.position.y = -10;
        panel.rotation.y = panel.userData.baseRotY;
      }
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
