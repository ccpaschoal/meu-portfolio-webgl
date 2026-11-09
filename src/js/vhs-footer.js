import { gsap } from 'gsap';
import { contacts } from '../data/contacts.js';

/**
 * Fase 5: Painel Frontal de Videocassete VHS Vintage (Rodapé / Contatos)
 * Interface de plástico rígido chanfrado cinza escuro/preto dos anos 80/90.
 * Botões físicos pesados mapeando comandos analógicos (Play, Stop, Rewind, FF, Eject),
 * símbolos entalhados em relevo, ícones SVG modernos, clique mecânico com rebote e LEDs.
 */
export function createVHSFooter() {
  const panel = document.createElement('section');
  panel.className = 'vhs-deck';
  panel.setAttribute('aria-label', 'Contatos em formato de videocassete vintage');

  // Topo chanfrado com marca e especificações técnicas
  const top = document.createElement('header');
  top.className = 'vhs-top';

  const brand = document.createElement('div');
  brand.className = 'vhs-brand';
  brand.innerHTML = 'PASCHOAL<small>HQ PRO-AUDIO</small>';

  const format = document.createElement('div');
  format.className = 'vhs-format';
  format.textContent = 'HI-FI STEREO / 4-HEAD';

  top.append(brand, format);

  // Compartimento de fita cassete e display digital fluorescente
  const middle = document.createElement('div');
  middle.className = 'vhs-middle';

  const slot = document.createElement('div');
  slot.className = 'cassette-slot';
  slot.innerHTML = '<span>▲ AUTO REVERSE CASSETTE DECK ▲</span>';

  const display = document.createElement('div');
  display.className = 'vhs-display';
  display.innerHTML = '<span class="vhs-rec">● REC</span><span class="vhs-counter">SP 0:24:00</span>';

  middle.append(slot, display);

  // Linha de botões físicos mecânicos
  const keys = document.createElement('div');
  keys.className = 'vhs-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Comandos do gravador e canais de contato');

  const symbols = ['▶', '■', '◀◀', '▶▶', '▲'];

  contacts.forEach((item, index) => {
    const key = document.createElement('a');
    key.className = 'vhs-key';
    key.href = item.href;
    key.target = item.href.startsWith('http') ? '_blank' : '_self';
    key.rel = item.href.startsWith('http') ? 'noopener noreferrer' : '';
    key.setAttribute('aria-label', `${item.label}: contato`);

    // Indicador LED sutil retrô (verde/âmbar)
    const led = document.createElement('span');
    led.className = 'vhs-led';
    led.setAttribute('aria-hidden', 'true');

    // Símbolo clássico entalhado em relevo
    const symbol = document.createElement('span');
    symbol.className = 'vhs-symbol';
    symbol.textContent = symbols[index] || '▶';

    // Ícone SVG moderno embutido
    const icon = document.createElement('span');
    icon.className = 'vhs-icon';
    icon.innerHTML = item.icon;

    // Etiqueta do comando
    const label = document.createElement('span');
    label.className = 'vhs-label';
    label.textContent = item.label;

    key.append(led, symbol, icon, label);

    // Engenharia de clique mecânico pesado e rebote
    const press = () => {
      gsap.to(key, {
        y: 4,
        scale: 0.98,
        boxShadow: '0 1px 0 #080c09, inset 0 2px 4px #000c',
        duration: 0.08,
        overwrite: 'auto'
      });
      gsap.to(led, {
        opacity: 1,
        boxShadow: '0 0 10px #73d98b',
        duration: 0.08,
        overwrite: 'auto'
      });
    };

    const release = () => {
      gsap.to(key, {
        y: 0,
        scale: 1,
        boxShadow: '0 5px 0 #080c09, 0 8px 12px #0008, inset 0 1px 0 #8b997c66',
        duration: 0.28,
        ease: 'back.out(2)',
        overwrite: 'auto'
      });
      gsap.to(led, {
        opacity: 0.4,
        boxShadow: '0 0 4px #4fae64',
        duration: 0.2,
        overwrite: 'auto'
      });
    };

    const hoverEnter = () => {
      gsap.to(led, {
        opacity: 0.85,
        boxShadow: '0 0 8px #73d98b',
        duration: 0.15,
        overwrite: 'auto'
      });
    };

    key.addEventListener('pointerenter', hoverEnter);
    key.addEventListener('pointerdown', press);
    key.addEventListener('pointerup', release);
    key.addEventListener('pointerleave', release);

    keys.append(key);
  });

  panel.append(top, middle, keys);
  return panel;
}
