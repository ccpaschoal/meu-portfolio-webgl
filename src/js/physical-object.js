import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

/** A live HTML face with four real side planes and a back in CSS3D space. */
export function createPhysicalObject(element, { width, height, depth, kind, color }) {
  const group = new THREE.Group();
  group.element = element;
  // The renderer owns this wrapper's matrix; visual CSS tweens stay on its child.
  const face = document.createElement('div');
  face.className = 'physical-face';
  face.append(element);
  group.add(new CSS3DObject(face));
  const sides = {};
  for (const side of ['left', 'right', 'top', 'bottom', 'back']) {
    const plane = document.createElement('div');
    plane.className = `physical-plane ${kind}-shell-edge physical-plane--${side}`;
    plane.style.background = color;
    plane.setAttribute('aria-hidden', 'true');
    const object = new CSS3DObject(plane);
    object.userData.side = side;
    group.add(object);
    sides[side] = object;
  }
  group.userData.shell = { sides, depth, kind };
  resizePhysicalObject(group, width, height);
  return group;
}

export function resizePhysicalObject(group, width, height) {
  const { sides, depth } = group.userData.shell;
  const size = (side, w, h) => { side.element.style.width = `${w}px`; side.element.style.height = `${h}px`; };
  for (const side of [sides.left, sides.right]) {
    size(side, depth, height);
    side.rotation.y = side === sides.left ? -Math.PI / 2 : Math.PI / 2;
    side.position.set((side === sides.left ? -1 : 1) * width / 2, 0, -depth / 2);
  }
  for (const side of [sides.top, sides.bottom]) {
    size(side, width, depth);
    side.rotation.x = side === sides.top ? -Math.PI / 2 : Math.PI / 2;
    side.position.set(0, (side === sides.top ? 1 : -1) * height / 2, -depth / 2);
  }
  size(sides.back, width, height);
  sides.back.rotation.y = Math.PI;
  sides.back.position.z = -depth;
}

export function setPhysicalOpacity(group, opacity) {
  const isVisible = opacity > 0.01;
  group.visible = isVisible;
  group.element.style.opacity = String(opacity);
  group.element.style.visibility = isVisible ? 'visible' : 'hidden';
  group.element.style.display = isVisible ? '' : 'none';
  group.element.style.pointerEvents = opacity < 0.05 ? 'none' : 'auto';
  group.element.inert = opacity < 0.05;
  Object.values(group.userData.shell.sides).forEach((side) => {
    side.visible = isVisible;
    side.element.style.opacity = String(opacity);
    side.element.style.visibility = isVisible ? 'visible' : 'hidden';
    side.element.style.display = isVisible ? '' : 'none';
  });
}
