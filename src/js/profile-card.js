import { gsap } from 'gsap';

/**
 * Fase 4: Foto Física Polaroid Autêntica (Seção Sobre)
 * Formato clássico 1:1 quadrado, queixo inferior largo em papel fosco de alta gramatura,
 * textura tátil analógica, assinatura manuscrita e inclinação 3D com sombra dinâmica oposta.
 */
export function createProfileCard(assets) {
  const photo = document.createElement('figure');
  photo.className = 'polaroid';
  photo.style.transformStyle = 'preserve-3d';

  // Moldura quadrada 1:1 para a fotografia analógica
  const pictureFrame = document.createElement('div');
  pictureFrame.className = 'polaroid-picture-frame';

  const source = '/assets/avatar-real.jpg';
  const image = assets?.get?.(source)?.cloneNode(true) || new Image();
  image.src = source;
  image.alt = 'Camilla Paschoal sorrindo';
  image.className = 'polaroid-photo-img';
  image.decoding = 'async';
  image.draggable = false;

  const photoGloss = document.createElement('div');
  photoGloss.className = 'polaroid-gloss';
  photoGloss.setAttribute('aria-hidden', 'true');

  pictureFrame.append(image, photoGloss);

  // Queixo inferior clássico de Polaroid com textura de papel encorpado
  const chin = document.createElement('figcaption');
  chin.className = 'polaroid-chin';

  // Assinatura analógica em tinta preta/azul com leve inclinação manuscrita
  const signature = document.createElement('div');
  signature.className = 'polaroid-signature';
  signature.innerHTML = 'Camilla Paschoal <span class="polaroid-date">’26</span>';

  const name = document.createElement('h3');
  name.className = 'polaroid-name';
  name.textContent = 'Camilla Paschoal';

  const role = document.createElement('span');
  role.className = 'polaroid-role';
  role.textContent = 'Web design & social media · Rio de Janeiro';

  const description = document.createElement('p');
  description.className = 'polaroid-desc';
  description.textContent = 'Sou designer de Social Media e transformo ideias em conteúdo que dá vontade de ler (e de salvar).';

  const detail = document.createElement('p');
  detail.className = 'polaroid-detail';
  detail.textContent = 'Foco em carrosséis com narrativa, páginas leves e identidades que conectam marcas reais a pessoas reais.';

  chin.append(signature, name, role, description, detail);
  photo.append(pictureFrame, chin);

  // Efeito de Inclinação Corporal 3D (Mouse Tilt) com projeção de sombra dinâmica oposta
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

    // Inclina no sentido do cursor e projeta sombra realista para o lado oposto
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
