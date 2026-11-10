import { getAssetUrl } from '../utils/assets.js';

/**
 * @typedef {Object} SpiralSlideItem
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} src  URL já resolvida com getAssetUrl
 */

/** @type {SpiralSlideItem[]} */
export const spiralSlidesData = [
  // 1. Apresentação (Camilla Paschoal) - Completo (6 lâminas)
  { id: 'camilla-1', title: 'Camilla Paschoal · 01', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/1.webp') },
  { id: 'camilla-2', title: 'Camilla Paschoal · 02', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/2.webp') },
  { id: 'camilla-3', title: 'Camilla Paschoal · 03', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/3.webp') },
  { id: 'camilla-4', title: 'Camilla Paschoal · 04', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/4.webp') },
  { id: 'camilla-5', title: 'Camilla Paschoal · 05', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/5.webp') },
  { id: 'camilla-6', title: 'Camilla Paschoal · 06', category: 'Apresentação', src: getAssetUrl('assets/carrosseis/0-apresentacao/6.webp') },

  // 2. AURA (Fone Bluetooth S3 Air) - Completo (capa, 2 lâminas e contracapa)
  { id: 'aura-1', title: 'AURA S3 Air · Capa', category: 'Loja AURA', src: getAssetUrl('assets/carrosseis/5-aura/capa.webp') },
  { id: 'aura-2', title: 'AURA S3 Air · 01', category: 'Loja AURA', src: getAssetUrl('assets/carrosseis/5-aura/1.webp') },
  { id: 'aura-3', title: 'AURA S3 Air · 02', category: 'Loja AURA', src: getAssetUrl('assets/carrosseis/5-aura/2.webp') },
  { id: 'aura-4', title: 'AURA S3 Air · Contracapa', category: 'Loja AURA', src: getAssetUrl('assets/carrosseis/5-aura/contracapa.webp') },

  // 3. Vanessa Chaves (Neuropsicologia / TDAH / TEA) - Capa (capa.webp) de cada carrossel (10 capas)
  { id: 'vanessa-1', title: 'Maior Dificuldade', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/1-maior-dificuldade/capa.webp') },
  { id: 'vanessa-2', title: 'Quem é Vanessa Chaves', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/1-quem-e-vanessa-chaves/capa.webp') },
  { id: 'vanessa-3', title: 'Calma em Casa', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/2-calma-em-casa/capa.webp') },
  { id: 'vanessa-4', title: 'Nosso Espaço', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/2-conhecendo-nosso-espaco/capa.webp') },
  { id: 'vanessa-5', title: 'Não Gritar', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/2-nao-gritar/capa.webp') },
  { id: 'vanessa-6', title: 'Autismo e Comunicação', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/3-autismo-e-comunicacao/capa.webp') },
  { id: 'vanessa-7', title: 'Nem todo Comportamento', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/3-nem-todo-comportamento/capa.webp') },
  { id: 'vanessa-8', title: 'E quem cuida da mãe?', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/4-e-quem-cuida-da-mae/capa.webp') },
  { id: 'vanessa-9', title: 'Neuroplasticidade', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/4-neuroplasticidade/capa.webp') },
  { id: 'vanessa-10', title: 'Equoterapia', category: 'Vanessa Chaves', src: getAssetUrl('assets/carrosseis/5-equoterapia/capa.webp') }
];
