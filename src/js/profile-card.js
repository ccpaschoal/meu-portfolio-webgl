import { gsap } from 'gsap';

/**
 * Fase 4: Cartão de Perfil / Foto Física Polaroid
 * Papel fosco espesso de alta gramatura com bordas brancas e textura analógica.
 * Inclui animação de entrada e inclinação corporal (Mouse Tilt 3D) com sombra oposta.
 */
export function createProfileCard(assets) {
  const photo = document.createElement('figure');
  photo.className = 'polaroid';
  photo.style.transformStyle = 'preserve-3d';

  const source = '/assets/avatar-real.jpg';
  const image = assets?.get?.(source)?.cloneNode(true) || new Image();
  image.src = source;
  image.alt = 'Camilla Paschoal sorrindo';
  image.decoding = 'async';
  image.draggable = false;

  const caption = document.createElement('figcaption');
  const name = document.createElement('h3');
  name.textContent = 'Camilla Paschoal';

  const role = document.createElement('span');
  role.className = 'polaroid-role';
  role.textContent = 'Web design & social media';

  const description = document.createElement('p');
  description.textContent = 'Sou designer de Social Media e transformo ideias em conteúdo que dá vontade de ler (e de salvar).';

  const detail = document.createElement('p');
  detail.className = 'polaroid-detail';
  detail.textContent = 'Foco em carrosséis com narrativa, páginas leves e identidades que conectam marcas reais a pessoas reais.';

  caption.append(name, role, description, detail);
  photo.append(image, caption);

  // Efeito de Inclinação Corporal 3D (Mouse Tilt) com sombra dinâmica oposta
  let bounds = null;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  photo.addEventListener('pointerenter', () => {
    bounds = photo.getBoundingClientRect();
  });

  photo.addEventListener('pointermove', (event) => {
    if (reducedMotion() || event.pointerType === 'touch') return;
    bounds = bounds || photo.getBoundingClientRect();

    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));

    // Inclina a foto no sentido do ponteiro e projeta sombra para o lado oposto
    gsap.to(photo, {
      rotateX: -y * 22,
      rotateY: x * 22,
      boxShadow: `${-x * 32 + 5}px ${25 - y * 28}px 55px rgba(0, 0, 0, 0.65), 4px 6px 0 #aaa69b`,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  });

  photo.addEventListener('pointerleave', () => {
    gsap.to(photo, {
      rotateX: 0,
      rotateY: 0,
      boxShadow: '5px 25px 50px rgba(0, 0, 0, 0.6), 4px 6px 0 #aaa69b',
      duration: 0.5,
      ease: 'back.out(1.2)',
      overwrite: 'auto'
    });
    bounds = null;
  });

  return photo;
}
