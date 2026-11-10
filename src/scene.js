import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sitesData } from './data/sites.js';
import { getAssetUrl } from './utils/assets.js';

/**
 * PORTFÓLIO WEBGL NATIVO — CAMILLA PASCHOAL
 * Narrativa Contínua em 4 Atos:
 * 00 / MATRIZ: Tríptico de Polaroids com desdobramento em leque
 * 01 / PELÍCULA: Fita Kodak 35mm contínua com ondulação física 3D (Sine-Wave), 4:5 e sem dead scroll
 * 02 / DIGITAL: 3 Smartphones 3D em arco dramático com chassi de titânio, safira e mouse tilt parallax
 * 03 / ARQUIVO: Deck VHS Master T-120 Dark Studio com botões monocromáticos e trava de scroll absoluta
 */

/* -------------------------------------------------------------
 * FUNÇÕES AUXILIARES DE GEOMETRIA E TEXTURA
 * ------------------------------------------------------------- */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedRectGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 16);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  return g;
}

function noiseTexture(size, base, amp) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = base + (Math.random() * 2 - 1) * amp;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class PortfolioScene {
  constructor(container) {
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.currentChapter = -1;
    this.isTransitioning = false;
    this.animId = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Raycaster e alvos interativos
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.clickableObjects = [];
    this.hoveredObject = null;

    // Mouse normalizado para Parallax / Tilt
    this.mouseNormX = 0;
    this.mouseNormY = 0;

    // Vetores reutilizáveis (zero GC no animate loop)
    this._ndc3 = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this.vMouse3D = new THREE.Vector3(99999, 99999, 0);
    this.planeDepth = -485;

    // Controle reativo de tracking glitch analógico do VHS
    this.isGlitching = false;
    this.glitchUntil = 0;
    this.nextRandomGlitchTime = performance.now() + 6000 + Math.random() * 2000;

    this.initRenderer();
    this.initScene();
    this.initLighting();

    // 1. Poeira Dual-Tone Reativa (6.500 partículas)
    this.buildDualToneDust();

    // 2. Os 4 Atos Narrativos
    this.buildChapter00(); // Tríptico de Polaroids
    this.buildChapter01(); // Fita Kodak 35mm com Ondulação 3D e 4:5
    this.buildChapter02(); // 3 Smartphones com Hardware Exposto e Mouse Tilt
    this.buildChapter03(); // Deck VHS Dark Studio com Trava Firme
    this.updateResponsiveLayout();

    // 3. Master Timeline GSAP Contínua
    this.initMasterTimeline();

    this.bindEvents();
    this.animate();
  }

  /* ==========================================================================
     RENDERIZADOR, CÂMERA & AMBIENTE
     ========================================================================== */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x030305, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy ? this.renderer.capabilities.getMaxAnisotropy() : 8;

    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 10, 8000);
    this.camera.position.set(0, 0, 1100);
    this.camera.lookAt(0, 0, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030305, 0.00032);
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;

    this.chapter00Group = new THREE.Group();
    this.chapter01Group = new THREE.Group();
    this.chapter02Group = new THREE.Group();
    this.chapter03Group = new THREE.Group();

    this.chapter00Group.visible = false;
    this.chapter01Group.visible = false;
    this.chapter02Group.visible = false;
    this.chapter03Group.visible = false;

    this.scene.add(
      this.chapter00Group,
      this.chapter01Group,
      this.chapter02Group,
      this.chapter03Group
    );
  }

  initLighting() {
    this.ambientLight = new THREE.AmbientLight(0x0e1320, 1.2);
    this.scene.add(this.ambientLight);

    // Luz Direcional Azul Cobalto
    this.blueKeyLight = new THREE.DirectionalLight(0x2563eb, 1.4);
    this.blueKeyLight.position.set(650, 450, 600);
    this.scene.add(this.blueKeyLight);

    // Luz Direcional Vinho Escuro (#991b1b)
    this.wineRimLight = new THREE.DirectionalLight(0x991b1b, 2.0);
    this.wineRimLight.position.set(-650, -250, -350);
    this.scene.add(this.wineRimLight);

    // Luz de recorte dedicada para a fita de película Kodak (#a5b4fc)
    this.filmRimLight = new THREE.SpotLight(0xa5b4fc, 0.0, 3400, Math.PI / 4, 0.35, 1.2);
    this.filmRimLight.position.set(250, 380, -180);
    this.filmRimLight.target.position.set(0, 0, 0);
    this.scene.add(this.filmRimLight, this.filmRimLight.target);

    // Luz de recorte especular focada nos smartphones e lentes de safira (#93c5fd)
    this.phoneRimLight = new THREE.SpotLight(0x93c5fd, 0.0, 3600, Math.PI / 3, 0.45, 1.1);
    this.phoneRimLight.position.set(360, 420, -260);
    this.phoneRimLight.target.position.set(0, 10, 0);
    this.scene.add(this.phoneRimLight, this.phoneRimLight.target);
  }

  /* ==========================================================================
     POEIRA DUAL-TONE (6.500 PARTÍCULAS EM BUFFER ÚNICO & GLOW REATIVO)
     ========================================================================== */
  buildDualToneDust() {
    const COUNT = 6500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const colorTypes = new Float32Array(COUNT);
    const scales = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(3200);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(1800);
      // Fundo atmosférico profundo posicionado atrás de todos os modelos 3D
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-750, -220);

      // 70% Cobalto/Prata translúcido (0.0), 30% Vinho Carmesim #991b1b (1.0)
      colorTypes[i] = Math.random() < 0.30 ? 1.0 : 0.0;
      scales[i] = 1.0 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColorType', new THREE.BufferAttribute(colorTypes, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    this.dustGeometry = geometry;
    this.dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uRadius: { value: 75.0 }, // Raio compacto calibrado
        uTime: { value: 0.0 },
        uWind: { value: 0.0 },
        uOpacity: { value: 1.0 }
      },
      vertexShader: `
        uniform vec3 uMouse;
        uniform float uRadius;
        uniform float uTime;
        uniform float uWind;
        uniform float uOpacity;
        attribute float aColorType;
        attribute float aScale;
        varying float vGlow;
        varying float vType;
        varying float vDustAlpha;

        void main() {
          vType = aColorType;
          vec3 pos = position;

          // Vento ascendente dinâmico ao sair da página preta: partículas arremessadas para cima
          float pSeed = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float windLift = uWind * (1450.0 + pSeed * 950.0);
          float windSway = sin(uTime * 3.0 + pos.y * 0.008 + pSeed * 6.28) * (uWind * 160.0);
          float windDraft = cos(uTime * 2.2 + pos.x * 0.008 + pSeed * 6.28) * (uWind * 90.0);

          pos.y += windLift;
          pos.x += windSway;
          pos.z += windDraft;

          // Flutuação orgânica serena e equilibrada (correntes cósmicas suaves)
          float t1 = uTime * 0.70;
          float t2 = uTime * 0.50;
          pos.x += sin(t1 + position.y * 0.005) * 16.0 + cos(t2 * 1.2 + position.z * 0.007) * 10.0;
          pos.y += cos(t2 + position.x * 0.005) * 15.0 + sin(t1 * 1.0 + position.z * 0.006) * 10.0;
          pos.z += sin(t1 * 0.65 + position.x * 0.004 + position.y * 0.004) * 12.0;

          // Projeção em profundidade precisa para calibrar cursor diretamente sobre a poeira
          float scaleAtZ = (1100.0 - pos.z) / 1585.0;
          vec2 mouseAtZ = uMouse.xy * scaleAtZ;

          float dist = length(pos.xy - mouseAtZ) / scaleAtZ;
          float glow = smoothstep(uRadius, 0.0, dist);
          vGlow = glow;

          // Repulsão e turbulência física fluida ao passar o mouse
          if (dist < uRadius && dist > 0.001) {
            vec2 dir = normalize(pos.xy - mouseAtZ);
            vec2 swirl = vec2(-dir.y, dir.x) * 0.35;
            pos.xy += (dir + swirl) * ((1.0 - dist / uRadius) * 45.0 * scaleAtZ);
          }

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float windSizeMult = mix(1.0, 0.4 + pSeed * 0.6, uWind);
          gl_PointSize = aScale * windSizeMult * (11.0 + glow * 18.0) * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;

          // Dissipação gradual com escalonamento per-partícula
          float particleLife = clamp(1.0 - uWind * (0.85 + pSeed * 0.45), 0.0, 1.0);
          vDustAlpha = uOpacity * particleLife;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vGlow;
        varying float vType;
        varying float vDustAlpha;

        void main() {
          if (vDustAlpha <= 0.001) discard;

          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.08, dist);

          vec3 blueBase = vec3(0.60, 0.68, 0.85);
          vec3 wineBase = vec3(0.60, 0.11, 0.11);
          vec3 baseColor = mix(blueBase, wineBase, vType);

          vec3 blueGlow = vec3(1.3, 1.6, 2.2); // Núcleo branco elétrico/cobalto
          vec3 wineGlow = vec3(2.0, 0.35, 0.35); // Borda brasa
          vec3 glowColor = mix(blueGlow, wineGlow, vType);

          vec3 finalColor = mix(baseColor, glowColor, vGlow);
          float finalAlpha = mix(alpha * 0.75, alpha * 1.0, vGlow) * vDustAlpha;

          if (finalAlpha <= 0.001) discard;

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geometry, this.dustMaterial);
    this.scene.add(this.dustParticles);
  }

  /* ==========================================================================
     ATO 00: TRÍPTICO DE POLAROIDS (DESDOBRAMENTO EM LEQUE)
     ========================================================================== */
  buildChapter00() {
    const frameGeo = new THREE.PlaneGeometry(330, 400);
    // Acabamento tátil de papel fotográfico acetinado sob luz de estúdio
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6f4eb,
      roughness: 0.52,
      metalness: 0.05,
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.2
    });
    const innerGeo = new THREE.PlaneGeometry(308, 308);

    // Textura de sombra de contacto suave para ancoragem física no espaço 3D
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128; shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    const sgrad = sctx.createRadialGradient(64, 64, 12, 64, 64, 62);
    sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    sgrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    sgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(380, 450);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    // --- POLAROID ESQUERDA (Identidade & Cargos) ---
    this.leftPolaroid = new THREE.Group();
    const leftShadow = new THREE.Mesh(shadowGeo, shadowMat);
    leftShadow.position.set(0, -12, -2.5);
    const leftFrame = new THREE.Mesh(frameGeo, frameMat);
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = 1024; leftCanvas.height = 1024;
    const ctxL = leftCanvas.getContext('2d');
    ctxL.fillStyle = '#0a0d14'; ctxL.fillRect(0, 0, 1024, 1024);

    // Tag superior nítida
    ctxL.font = '700 44px "Space Mono", monospace'; ctxL.fillStyle = '#3b82f6';
    ctxL.fillText('00 / IDENTIDADE', 75, 145);

    // Linha divisória cobalto
    ctxL.strokeStyle = 'rgba(59, 130, 246, 0.4)'; ctxL.lineWidth = 3.5;
    ctxL.beginPath(); ctxL.moveTo(75, 175); ctxL.lineTo(420, 175); ctxL.stroke();

    // Nome em destaque editorial ampliado
    ctxL.font = '700 96px "Inter", sans-serif'; ctxL.fillStyle = '#ffffff';
    ctxL.fillText('CAMILLA', 75, 305);
    ctxL.fillText('PASCHOAL', 75, 405);

    // Cargos com tamanho e contraste reforçados
    ctxL.font = '700 50px "Space Mono", monospace'; ctxL.fillStyle = '#f8fafc';
    ctxL.fillText('SOCIAL MEDIA DESIGNER', 75, 565);
    ctxL.fillText('WEB DEVELOPER', 75, 645);
    ctxL.fillText('AI PRODUCT BUILDER', 75, 725);

    // Subtítulo de atuação
    ctxL.font = '400 36px "Inter", sans-serif'; ctxL.fillStyle = '#94a3b8';
    ctxL.fillText('Rio de Janeiro, Brasil · Global Delivery', 75, 835);

    const leftTex = new THREE.CanvasTexture(leftCanvas);
    leftTex.colorSpace = THREE.SRGBColorSpace;
    const leftInner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({
      map: leftTex,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }));
    leftInner.position.set(0, 36, 1.2);
    this.leftPolaroid.add(leftFrame, leftInner, leftShadow);

    // --- POLAROID CENTRAL (Foto Pessoal 100% Pura: Sem Efeito Claro / Sem Edição) ---
    this.centerPolaroid = new THREE.Group();
    const centerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    centerShadow.position.set(0, -12, -2.5);
    const centerFrame = new THREE.Mesh(frameGeo, frameMat);
    const photoTex = new THREE.TextureLoader().load(getAssetUrl('avatar-real.jpg'));
    photoTex.colorSpace = THREE.SRGBColorSpace;
    const centerInner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({
      map: photoTex,
      toneMapped: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }));
    centerInner.position.set(0, 36, 1.2);
    this.centerPolaroid.add(centerFrame, centerInner, centerShadow);

    // --- POLAROID DIREITA (Visão & Prática dos 3 Pilares) ---
    this.rightPolaroid = new THREE.Group();
    const rightShadow = new THREE.Mesh(shadowGeo, shadowMat);
    rightShadow.position.set(0, -12, -2.5);
    const rightFrame = new THREE.Mesh(frameGeo, frameMat);
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = 1024; rightCanvas.height = 1024;
    const ctxR = rightCanvas.getContext('2d');
    ctxR.fillStyle = '#0a0d14'; ctxR.fillRect(0, 0, 1024, 1024);

    // Tag superior
    ctxR.font = '700 44px "Space Mono", monospace'; ctxR.fillStyle = '#ef4444';
    ctxR.fillText('00 / PRÁTICA & VISÃO', 75, 145);

    // Linha divisória rubi
    ctxR.strokeStyle = 'rgba(239, 68, 68, 0.4)'; ctxR.lineWidth = 3.5;
    ctxR.beginPath(); ctxR.moveTo(75, 175); ctxR.lineTo(440, 175); ctxR.stroke();

    // 1. Social Media Design
    ctxR.font = '700 48px "Inter", sans-serif'; ctxR.fillStyle = '#ffffff';
    ctxR.fillText('SOCIAL MEDIA DESIGN', 75, 255);
    ctxR.font = '400 38px "Inter", sans-serif'; ctxR.fillStyle = '#cbd5e1';
    ctxR.fillText('Carrosséis contínuos e direção de arte', 75, 305);
    ctxR.fillText('estratégica para retenção e autoridade.', 75, 350);

    // 2. Web Development
    ctxR.font = '700 48px "Inter", sans-serif'; ctxR.fillStyle = '#ffffff';
    ctxR.fillText('WEB DEVELOPMENT', 75, 470);
    ctxR.font = '400 38px "Inter", sans-serif'; ctxR.fillStyle = '#cbd5e1';
    ctxR.fillText('Interfaces 3D imersivas com Three.js,', 75, 520);
    ctxR.fillText('WebGL e arquitetura moderna veloz.', 75, 565);

    // 3. AI Product Builder
    ctxR.font = '700 48px "Inter", sans-serif'; ctxR.fillStyle = '#ffffff';
    ctxR.fillText('AI PRODUCT BUILDER', 75, 685);
    ctxR.font = '400 38px "Inter", sans-serif'; ctxR.fillStyle = '#cbd5e1';
    ctxR.fillText('Produtos e ecossistemas impulsionados', 75, 735);
    ctxR.fillText('por inteligência artificial e automação.', 75, 780);

    const rightTex = new THREE.CanvasTexture(rightCanvas);
    rightTex.colorSpace = THREE.SRGBColorSpace;
    const rightInner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({
      map: rightTex,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }));
    rightInner.position.set(0, 36, 1.2);
    this.rightPolaroid.add(rightFrame, rightInner, rightShadow);

    this.polaroidMaterials = [frameMat, leftInner.material, centerInner.material, rightInner.material, shadowMat];
    this.polaroidMaterials.forEach(material => {
      material.transparent = true;
    });

    // Estado inicial empilhado no rodapé profundo (evita snap de posição ao revelar o teaser)
    this.leftPolaroid.position.set(0, -650, 0);
    this.leftPolaroid.rotation.set(0, 0, 0.02);
    this.rightPolaroid.position.set(0, -650, 5);
    this.rightPolaroid.rotation.set(0, 0, -0.02);
    this.centerPolaroid.position.set(0, -650, 15);
    this.centerPolaroid.rotation.set(0, 0, 0.005);

    this.chapter00Group.add(this.leftPolaroid, this.centerPolaroid, this.rightPolaroid);
    this.updateResponsiveLayout();
  }

  /* ==========================================================================
     ATO 01: FITA KODAK 35MM COM ONDULAÇÃO FÍSICA 3D (SINE WAVE), 4:5 E SEM DEAD SCROLL
     ========================================================================== */
  buildChapter01() {
    this.kodakFilmStrip = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // 6 lâminas contínuas da Apresentação (Aura removido conforme solicitação)
    const slidePaths = [
      getAssetUrl('assets/carrosseis/0-apresentacao/1.webp'),
      getAssetUrl('assets/carrosseis/0-apresentacao/2.webp'),
      getAssetUrl('assets/carrosseis/0-apresentacao/3.webp'),
      getAssetUrl('assets/carrosseis/0-apresentacao/4.webp'),
      getAssetUrl('assets/carrosseis/0-apresentacao/5.webp'),
      getAssetUrl('assets/carrosseis/0-apresentacao/6.webp')
    ];

    // Dimensões editoriais: Fotograma 176x220 (proporção 4:5 matemática exata: 220 * 0.8 = 176)
    // Fita com 280 unidades (30 unidades de borda perfurada no topo e 30 na base)
    const FRAME_W = 176;
    const FRAME_H = 220;
    const RIBBON_H = 280;
    const LEADER_W = 176;
    const TAIL_W = 176;

    // Curvatura espacial 3D em profundidade Z (alinhamento editorial perfeito com delta Y = 0 entre lâminas)
    const zOffset = (x) => Math.sin(x * 0.0032) * 68.0;
    const rotYOffset = (x) => -Math.cos(x * 0.0032) * 0.218;

    // Cálculo das coordenadas horizontais:
    // Alinhamento Inicial: Slide 0 de Apresentação nasce EXATAMENTE em X = 0 (centro da lente)
    // O Leader fica à esquerda de Slide 0: x = -190
    const leaderCenterX = -190;
    const minX = leaderCenterX - LEADER_W / 2 - 20;

    const positionsX = [];
    let curX = 0; // Centro do Slide 0

    for (let i = 0; i < slidePaths.length; i++) {
      positionsX.push(curX);
      curX += FRAME_W; // gap 0 perfeito nas 6 lâminas panorâmicas contínuas da Apresentação
    }

    const tailCenterX = curX + TAIL_W / 2 + 10;
    const maxX = tailCenterX + TAIL_W / 2 + 20;
    const TOTAL_W = maxX - minX;
    this.totalFilmWidth = TOTAL_W;

    // 1. Malha geométrica de referência (fita oculta para manter as fotos flutuando 100% puras e sem moldura preta)
    const segmentsX = Math.max(180, Math.floor(TOTAL_W / 10));
    const ribbonGeo = new THREE.PlaneGeometry(TOTAL_W, RIBBON_H, segmentsX, 2);
    const rpos = ribbonGeo.attributes.position;
    const ribbonCenterX = minX + TOTAL_W / 2;
    for (let i = 0; i < rpos.count; i++) {
      const vx = rpos.getX(i);
      const gx = vx + ribbonCenterX;
      rpos.setZ(i, zOffset(gx));
    }
    rpos.needsUpdate = true;
    ribbonGeo.computeVertexNormals();

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0x070709,
      roughness: 0.18,
      metalness: 0.88,
      side: THREE.DoubleSide
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.set(ribbonCenterX, 0, 0);
    ribbonMesh.visible = false; // Moldura da fita removida: fotos flutuam puras
    this.kodakFilmStrip.add(ribbonMesh);

    // 2. Leader inicial oculto
    const leaderCanvas = document.createElement('canvas');
    leaderCanvas.width = 512; leaderCanvas.height = 700;
    const lctx = leaderCanvas.getContext('2d');
    lctx.fillStyle = '#08080a'; lctx.fillRect(0, 0, 512, 700);
    const leaderTex = new THREE.CanvasTexture(leaderCanvas);

    const leaderGeo = new THREE.PlaneGeometry(LEADER_W, FRAME_H, 20, 2);
    const lpos = leaderGeo.attributes.position;
    const lrotY = rotYOffset(leaderCenterX);
    const lcosR = Math.cos(lrotY);
    const lsinR = Math.sin(lrotY);
    const lpz = zOffset(leaderCenterX) + 2.5;
    for (let k = 0; k < lpos.count; k++) {
      const lx = lpos.getX(k);
      const gx = leaderCenterX + lx * lcosR;
      const targetWorldZ = zOffset(gx) + 2.5;
      const lz = (targetWorldZ - (lpz - lx * lsinR)) / lcosR;
      lpos.setZ(k, lz);
    }
    lpos.needsUpdate = true;
    leaderGeo.computeVertexNormals();

    const leaderMesh = new THREE.Mesh(
      leaderGeo,
      new THREE.MeshBasicMaterial({ map: leaderTex, visible: false })
    );
    leaderMesh.position.set(leaderCenterX, 0, lpz);
    leaderMesh.rotation.y = lrotY;
    leaderMesh.visible = false;
    this.kodakFilmStrip.add(leaderMesh);

    // 3. Perfurações ocultas (fotos limpas sem interferência de furos)
    const perfGeo = new THREE.PlaneGeometry(10, 18);
    const perfMat = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
    const numPerfs = Math.floor(TOTAL_W / 32);
    for (let i = 0; i < numPerfs; i++) {
      const px = minX + i * 32 + 16;
      const pz = zOffset(px) + 1.2;
      const rotY = rotYOffset(px);

      const topP = new THREE.Mesh(perfGeo, perfMat);
      topP.position.set(px, 125, pz);
      topP.rotation.y = rotY;
      topP.visible = false;

      const botP = new THREE.Mesh(perfGeo, perfMat);
      botP.position.set(px, -125, pz);
      botP.rotation.y = rotY;
      botP.visible = false;

      this.kodakFilmStrip.add(topP, botP);
    }

    // 4. Instanciação das 10 lâminas (Lâminas Livres e Soltas no Espaço 3D)
    // As fotos surgem soltas, flutuando com autonomia e perfeitamente alinhadas nos panoramas
    this.filmSlides = [];
    slidePaths.forEach((src, idx) => {
      const tex = loader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = this.maxAniso;

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.28,
        metalness: 0.08,
        envMapIntensity: 1.6,
        transparent: true,
        opacity: 1.0
      });

      const px = positionsX[idx];
      const rotY = rotYOffset(px);
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      const pz = zOffset(px) + 2.5;

      const slideGeo = new THREE.PlaneGeometry(FRAME_W, FRAME_H, 24, 2);
      const spos = slideGeo.attributes.position;
      for (let k = 0; k < spos.count; k++) {
        const lx = spos.getX(k);
        const gx = px + lx * cosR;
        const targetWorldZ = zOffset(gx) + 2.5;
        const lz = (targetWorldZ - (pz - lx * sinR)) / cosR;
        spos.setZ(k, lz);
      }
      spos.needsUpdate = true;
      slideGeo.computeVertexNormals();

      const mesh = new THREE.Mesh(slideGeo, mat);
      mesh.position.set(px, 0, pz);
      mesh.rotation.y = rotY;
      mesh.userData = {
        index: idx,
        baseX: px,
        baseY: 0,
        baseZ: pz,
        baseRotY: rotY,
        baseRotZ: 0
      };
      this.filmSlides.push(mesh);
      this.kodakFilmStrip.add(mesh);
    });

    // 5. Tail final oculto
    const tailCanvas = document.createElement('canvas');
    tailCanvas.width = 512; tailCanvas.height = 700;
    const tailTex = new THREE.CanvasTexture(tailCanvas);
    const tailGeo = new THREE.PlaneGeometry(TAIL_W, FRAME_H, 20, 2);
    const tailMesh = new THREE.Mesh(
      tailGeo,
      new THREE.MeshBasicMaterial({ map: tailTex, visible: false })
    );
    tailMesh.position.set(tailCenterX, 0, zOffset(tailCenterX) + 2.5);
    tailMesh.rotation.y = rotYOffset(tailCenterX);
    tailMesh.visible = false;
    this.kodakFilmStrip.add(tailMesh);

    this.tailCenterX = tailCenterX;
    this.maxFilmX = maxX;
    this.chapter01Group.add(this.kodakFilmStrip);
  }

  /* ==========================================================================
     ATO 02: SMARTPHONE HERO AMPLIADO MONOLÍTICO, RESOLUÇÃO 1:1 E PLATÔ DE LEITURA
     ========================================================================== */
  buildChapter02() {
    this.phoneHero = new THREE.Group();
    this.activeSiteIndex = 0;
    this.siteImages = sitesData.map((site, index) => {
      const image = new Image();
      image.onload = () => {
        if (index === this.activeSiteIndex && !this.siteTransition?.isActive()) {
          this.drawSiteSlide(index, index, 0, 1);
        }
      };
      image.src = getAssetUrl(site.image || site.thumb);
      return image;
    });

    // Resolução nativa exata 1:1 dos prints mobile (780 x 1688)
    this.siteScreenCanvas = document.createElement('canvas');
    this.siteScreenCanvas.width = 780;
    this.siteScreenCanvas.height = 1688;
    this.siteScreenCtx = this.siteScreenCanvas.getContext('2d');
    this.siteScreenTexture = new THREE.CanvasTexture(this.siteScreenCanvas);
    this.siteScreenTexture.colorSpace = THREE.SRGBColorSpace;
    this.siteScreenTexture.generateMipmaps = true;
    this.siteScreenTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.siteScreenTexture.magFilter = THREE.LinearFilter;
    if (this.renderer.capabilities.getMaxAnisotropy) {
      this.siteScreenTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    this.drawSiteSlide(0, 0, 0, 1);

    // Dimensões ampliadas do Smartphone Hero (~45% maior, proporção 1:1 exata com os prints mobile 780x1688)
    const PHONE_W = 224;
    const PHONE_H = 480;
    const PHONE_D = 15;
    const BEVEL = 3.5;
    const SCREEN_W = 212;
    const SCREEN_H = 458.8; // 212 * (1688 / 780) = 458.815 (proporção matemática 1:1 sem distorção)

    // 1. Chassi usinado em titânio escovado com cantos arredondados e chanfro usinado
    const chassisGeo = new THREE.ExtrudeGeometry(roundedRectShape(PHONE_W, PHONE_H, 26), {
      depth: PHONE_D,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: BEVEL,
      bevelThickness: BEVEL
    });
    chassisGeo.center();

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x363a46,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 2.2
    });
    const chassis = new THREE.Mesh(chassisGeo, titaniumMat);
    this.phoneHero.add(chassis);

    // 2. Display frontal OLED com cantos arredondados e textura do site em alta resolução
    const screenGeo = roundedRectGeometry(SCREEN_W, SCREEN_H, 20);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.siteScreenTexture,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0, PHONE_D / 2 + BEVEL + 0.1);
    this.phoneHero.add(screen);

    // 3. Dynamic Island pill & selfie camera no topo da tela
    const pillGeo = roundedRectGeometry(46, 14, 7);
    const pillMat = new THREE.MeshBasicMaterial({ color: 0x020306 });
    const pill = new THREE.Mesh(pillGeo, pillMat);
    pill.position.set(0, SCREEN_H / 2 - 22, PHONE_D / 2 + BEVEL + 0.2);

    const selfieMat = new THREE.MeshBasicMaterial({ color: 0x08182c });
    const selfieLens = new THREE.Mesh(
      new THREE.CircleGeometry(3, 16),
      selfieMat
    );
    selfieLens.position.set(11, SCREEN_H / 2 - 22, PHONE_D / 2 + BEVEL + 0.25);
    this.phoneHero.add(pill, selfieLens);

    // 4. Vidro frontal com clearcoat especular e reflexo de estúdio
    const glassGeo = roundedRectGeometry(SCREEN_W + 2, SCREEN_H + 2, 21);
    const frontGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x05070a,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 0.7,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.08,
      depthWrite: false
    });
    const glassFront = new THREE.Mesh(glassGeo, frontGlassMat);
    glassFront.position.set(0, 0, PHONE_D / 2 + BEVEL + 0.35);
    this.phoneHero.add(glassFront);

    // 5. Painel traseiro em vidro fosco acetinado
    const backGeo = roundedRectGeometry(PHONE_W - 2, PHONE_H - 2, 25);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x181a22,
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 1.5
    });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, 0, -PHONE_D / 2 - BEVEL - 0.1);
    back.rotation.y = Math.PI;
    this.phoneHero.add(back);

    // 6. Módulo de câmaras traseiras com relevo (bump island) e cantos curvos
    const islandGeo = new THREE.ExtrudeGeometry(roundedRectShape(92, 98, 20), {
      depth: 3.5,
      bevelEnabled: true,
      bevelSize: 1.8,
      bevelThickness: 1.8,
      bevelSegments: 3
    });
    islandGeo.center();
    const island = new THREE.Mesh(islandGeo, titaniumMat);
    island.position.set(-PHONE_W / 2 + 56, PHONE_H / 2 - 62, -PHONE_D / 2 - BEVEL - 3.5);
    island.rotation.y = Math.PI;
    this.phoneHero.add(island);

    // 3 Lentes ópticas de safira com aros metálicos usinados em relevo
    const ringGeo = new THREE.CylinderGeometry(16, 16, 4.0, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5a6072,
      metalness: 0.95,
      roughness: 0.12
    });
    const lensGlassGeo = new THREE.CircleGeometry(13.5, 32);
    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x08101e,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    });

    const lensCoords = [
      { dx: -22, dy: 24 },
      { dx: -22, dy: -24 },
      { dx: 24, dy: 0 }
    ];
    lensCoords.forEach(c => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(island.position.x + c.dx, island.position.y + c.dy, -PHONE_D / 2 - BEVEL - 6.0);

      const lens = new THREE.Mesh(lensGlassGeo, lensGlassMat);
      lens.position.set(island.position.x + c.dx, island.position.y + c.dy, -PHONE_D / 2 - BEVEL - 8.2);
      lens.rotation.y = Math.PI;

      this.phoneHero.add(ring, lens);
    });

    // Flash & LiDAR
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
    const flash = new THREE.Mesh(new THREE.CircleGeometry(6, 20), flashMat);
    flash.position.set(island.position.x + 24, island.position.y + 26, -PHONE_D / 2 - BEVEL - 5.5);
    flash.rotation.y = Math.PI;

    const lidarMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.1, metalness: 0.9 });
    const lidar = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), lidarMat);
    lidar.position.set(island.position.x + 24, island.position.y - 26, -PHONE_D / 2 - BEVEL - 5.5);
    lidar.rotation.y = Math.PI;

    this.phoneHero.add(flash, lidar);

    // 7. Botões físicos metálicos no perfil de titânio (Power, Volume e Ação)
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x4e5362,
      metalness: 0.94,
      roughness: 0.18
    });
    // Botão Power / Lateral direita
    const powerBtn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 54, 6), btnMat);
    powerBtn.position.set(PHONE_W / 2 + BEVEL + 1.25, 42, 0);

    // Botões Volume Up, Down e Ação / Lateral esquerda
    const volUpBtn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 36, 6), btnMat);
    volUpBtn.position.set(-PHONE_W / 2 - BEVEL - 1.25, 52, 0);

    const volDownBtn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 36, 6), btnMat);
    volDownBtn.position.set(-PHONE_W / 2 - BEVEL - 1.25, 8, 0);

    const actionBtn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 20, 6), btnMat);
    actionBtn.position.set(-PHONE_W / 2 - BEVEL - 1.25, 96, 0);

    // Porta USB-C na base
    const usbcMat = new THREE.MeshBasicMaterial({ color: 0x06070a });
    const usbc = new THREE.Mesh(
      new THREE.BoxGeometry(18, 5, 2),
      usbcMat
    );
    usbc.position.set(0, -PHONE_H / 2 - BEVEL - 0.5, 0);

    this.phoneHero.add(powerBtn, volUpBtn, volDownBtn, actionBtn, usbc);

    // Coleção de materiais do celular para desvanecimento progressivo no recuo
    this.phoneMaterials = [
      titaniumMat,
      screenMat,
      pillMat,
      selfieMat,
      backMat,
      ringMat,
      lensGlassMat,
      flashMat,
      lidarMat,
      btnMat,
      usbcMat
    ];
    this.phoneMaterials.forEach(m => {
      m.transparent = true;
      m.opacity = 1.0;
    });
    this.phoneFrontGlassMat = frontGlassMat;

    // Posição e rotação em perspectiva 3D cinematográfica (Apple Showcase Angle)
    const baseRot = { x: 0.03, y: -0.14, z: 0.01 };
    this.phoneHero.position.set(0, 10, 40);
    this.phoneHero.rotation.set(baseRot.x, baseRot.y, baseRot.z);

    // Metadados interativos táteis para o Raycaster
    this.phoneHero.userData = {
      isClickable: true,
      url: sitesData[0]?.link || sitesData[0]?.href || 'https://aconchegoeventos.pages.dev',
      title: sitesData[0]?.title || 'Aconchego Festas e Eventos',
      targetPos: { x: 0, y: 10, z: 40 },
      targetRot: baseRot,
      baseScale: 1.0,
      onHoverStart: () => {
        gsap.to(this.phoneHero.scale, { x: 1.03, y: 1.03, z: 1.03, duration: 0.3, ease: 'power2.out' });
      },
      onHoverEnd: () => {
        gsap.to(this.phoneHero.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.3, ease: 'power2.out' });
      }
    };

    this.phone = this.phoneHero;
    this.phonesList = [this.phoneHero];
    this.clickableObjects.push(this.phoneHero);
    this.chapter02Group.add(this.phoneHero);
  }

  drawSiteSlide(fromIndex, toIndex, progress, direction) {
    const ctx = this.siteScreenCtx;
    if (!ctx) return;
    const width = this.siteScreenCanvas.width;
    const height = this.siteScreenCanvas.height;
    ctx.fillStyle = '#0b0e16';
    ctx.fillRect(0, 0, width, height);
    const from = this.siteImages[fromIndex];
    const to = this.siteImages[toIndex];
    if (from?.naturalWidth) ctx.drawImage(from, -direction * progress * width, 0, width, height);
    if (progress > 0 && to?.naturalWidth) {
      ctx.drawImage(to, direction * (1 - progress) * width, 0, width, height);
    }
    this.siteScreenTexture.needsUpdate = true;
  }

  async showSite(direction) {
    if (this.siteTransition?.isActive()) return false;
    const next = (this.activeSiteIndex + direction + sitesData.length) % sitesData.length;
    const current = this.activeSiteIndex;
    try {
      await Promise.all([this.siteImages[current].decode(), this.siteImages[next].decode()]);
    } catch {
      return false;
    }
    this.phone.userData.isClickable = false;
    const state = { progress: 0 };
    return new Promise(resolve => {
      this.siteTransition = gsap.to(state, {
        progress: 1,
        duration: this.reducedMotion.matches ? 0 : 0.58,
        ease: 'power2.inOut',
        onUpdate: () => this.drawSiteSlide(current, next, state.progress, direction),
        onComplete: () => {
          this.activeSiteIndex = next;
          this.drawSiteSlide(next, next, 0, 1);
          this.phone.userData.url = sitesData[next].link;
          this.phone.userData.title = sitesData[next].title;
          this.phone.userData.isClickable = true;
          this.onSiteChange?.(sitesData[next], next, sitesData.length);
          resolve(true);
        }
      });
    });
  }

  nextPhoneSite() {
    return this.showSite(1);
  }

  prevPhoneSite() {
    return this.showSite(-1);
  }

  getCurrentSiteIndex() {
    return this.activeSiteIndex;
  }

  /* ==========================================================================
     ATO 03: DECK VHS DARK STUDIO COM RÓTULO NÍTIDO, GLITCH CONTROLADO E TRAVA
     ========================================================================== */
  buildChapter03() {
    this.vhsCassette = new THREE.Group();
    this.vhsCassette.position.set(0, -30, 0);

    const CW = 560;
    const CH = 308;
    const bump = noiseTexture(256, 128, 90);
    bump.repeat.set(1 / 60, 1 / 60);

    // Gabinete analógico plástico com textura bump
    const plasticMat = new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.82,
      metalness: 0.08,
      bumpMap: bump,
      bumpScale: 1.4
    });
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(CW, CH, 10), {
      depth: 64,
      bevelEnabled: true,
      bevelSize: 2,
      bevelThickness: 2,
      bevelSegments: 2
    });
    bodyGeo.center();
    const vhsBody = new THREE.Mesh(bodyGeo, plasticMat);

    // 1. Rótulo clássico VHS em ultra-resolução (2048 x 1024) com controle de glitch
    this.cleanLabelCanvas = document.createElement('canvas');
    this.cleanLabelCanvas.width = 2048;
    this.cleanLabelCanvas.height = 1024;
    const cleanCtx = this.cleanLabelCanvas.getContext('2d');

    // Fundo marfim acetinado
    cleanCtx.fillStyle = '#f0eee6';
    cleanCtx.fillRect(0, 0, 2048, 1024);

    // Compensação anamórfica da geometria 3D (512x140) para manter proporção 1:1 absoluta
    cleanCtx.save();
    cleanCtx.scale(1, 1.8285);

    // Faixas de cor analógicas (vermelho rubi e azul cobalto)
    cleanCtx.fillStyle = '#991b1b';
    cleanCtx.fillRect(0, 0, 2048, 52);
    cleanCtx.fillStyle = '#2563eb';
    cleanCtx.fillRect(0, 52, 2048, 28);

    // Tipografia nítida e cristalina
    cleanCtx.fillStyle = '#141416';
    cleanCtx.font = '700 82px "Space Mono", monospace';
    cleanCtx.fillText('CAMILLA PASCHOAL · MASTER T-120', 84, 195);

    cleanCtx.font = '600 46px "Inter", sans-serif';
    cleanCtx.fillStyle = '#2c2d35';
    cleanCtx.fillText('STATUS: DISPONÍVEL PARA PROJETOS & DESAFIOS DIGITAIS', 84, 290);

    cleanCtx.font = '700 42px "Space Mono", monospace';
    cleanCtx.fillStyle = '#991b1b';
    cleanCtx.fillText('CONTATO DIRETO: CLIQUE NAS TECLAS ABAIXO', 84, 385);

    cleanCtx.font = '400 36px "Space Mono", monospace';
    cleanCtx.fillStyle = '#666670';
    cleanCtx.fillText('RIO DE JANEIRO, BR · DESIGNER, DEVELOPER, AI BUILDER', 84, 475);
    cleanCtx.restore();

    this.vhsLabelCanvas = document.createElement('canvas');
    this.vhsLabelCanvas.width = 2048;
    this.vhsLabelCanvas.height = 1024;
    this.vhsLabelCtx = this.vhsLabelCanvas.getContext('2d');
    this.vhsLabelCtx.drawImage(this.cleanLabelCanvas, 0, 0);

    this.vhsLabelTexture = new THREE.CanvasTexture(this.vhsLabelCanvas);
    this.vhsLabelTexture.colorSpace = THREE.SRGBColorSpace;
    this.vhsLabelTexture.generateMipmaps = true;
    this.vhsLabelTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.vhsLabelTexture.magFilter = THREE.LinearFilter;
    if (this.renderer.capabilities.getMaxAnisotropy) {
      this.vhsLabelTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }

    const labelMat = new THREE.MeshBasicMaterial({
      map: this.vhsLabelTexture,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(512, 126),
      labelMat
    );
    // Z = 35.2 fica em plano frontal sem Z-fighting com o gabinete Z = 34
    // Y = 68 posiciona o rótulo com folga ampla acima das bobinas de fita (que ficam em Y = -50)
    labelMesh.position.set(0, 68, 35.2);

    // 2. Bobinas giratórias da fita com detalhes mecânicos reais (aletas, dentes, engrenagem e fita)
    const spoolCanvas = document.createElement('canvas');
    spoolCanvas.width = 512; spoolCanvas.height = 512;
    const sctx = spoolCanvas.getContext('2d');
    const cx = 256, cy = 256;

    // Disco externo marfim da bobina
    sctx.beginPath();
    sctx.arc(cx, cy, 246, 0, Math.PI * 2);
    sctx.fillStyle = '#eae6db';
    sctx.fill();
    sctx.lineWidth = 5;
    sctx.strokeStyle = '#c4c0b4';
    sctx.stroke();

    // Anel de guia externo
    sctx.beginPath();
    sctx.arc(cx, cy, 226, 0, Math.PI * 2);
    sctx.lineWidth = 2.5;
    sctx.strokeStyle = 'rgba(180, 175, 160, 0.6)';
    sctx.stroke();

    // Fita magnética escura enrolada no miolo
    sctx.beginPath();
    sctx.arc(cx, cy, 185, 0, Math.PI * 2);
    sctx.fillStyle = '#181b22';
    sctx.fill();

    // Flange do cubo central (marfim)
    sctx.beginPath();
    sctx.arc(cx, cy, 126, 0, Math.PI * 2);
    sctx.fillStyle = '#f5f3ec';
    sctx.fill();
    sctx.lineWidth = 3.5;
    sctx.strokeStyle = '#b8b4a6';
    sctx.stroke();

    // 3 Aletas / Dentes de engate mecânico do VHS (a cada 120 graus)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      sctx.save();
      sctx.translate(cx, cy);
      sctx.rotate(angle);
      
      // Cavidade do dente
      sctx.fillStyle = '#0c0e14';
      sctx.beginPath();
      sctx.roundRect(-16, 42, 32, 70, 4);
      sctx.fill();

      // Dente de trava em relevo
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(-10, 48, 20, 24);
      sctx.restore();
    }

    // 3 Furos de alívio circulares entre as aletas
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + Math.PI / 3;
      const fx = cx + Math.cos(angle) * 78;
      const fy = cy + Math.sin(angle) * 78;
      sctx.beginPath();
      sctx.arc(fx, fy, 16, 0, Math.PI * 2);
      sctx.fillStyle = '#10121a';
      sctx.fill();
      sctx.lineWidth = 2.5;
      sctx.strokeStyle = '#d4d0c2';
      sctx.stroke();
    }

    // Engrenagem central estriada (spindle teeth)
    sctx.beginPath();
    sctx.arc(cx, cy, 48, 0, Math.PI * 2);
    sctx.fillStyle = '#222632';
    sctx.fill();

    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const gx = cx + Math.cos(angle) * 42;
      const gy = cy + Math.sin(angle) * 42;
      sctx.beginPath();
      sctx.arc(gx, gy, 6.5, 0, Math.PI * 2);
      sctx.fillStyle = '#f0eee8';
      sctx.fill();
    }

    // Eixo central vazado
    sctx.beginPath();
    sctx.arc(cx, cy, 24, 0, Math.PI * 2);
    sctx.fillStyle = '#06070a';
    sctx.fill();

    const spoolTexture = new THREE.CanvasTexture(spoolCanvas);
    spoolTexture.colorSpace = THREE.SRGBColorSpace;
    spoolTexture.generateMipmaps = true;
    spoolTexture.minFilter = THREE.LinearMipmapLinearFilter;
    spoolTexture.anisotropy = this.maxAniso;

    const spoolMat = new THREE.MeshBasicMaterial({
      map: spoolTexture,
      transparent: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    // Diâmetro compacto calibrado (raio 22) com respiro generoso em relação ao rótulo e botões
    const spoolGeo = new THREE.CircleGeometry(22, 36);

    this.spool1 = new THREE.Mesh(spoolGeo, spoolMat);
    this.spool1.position.set(-130, -50, 35.6);

    this.spool2 = new THREE.Mesh(spoolGeo, spoolMat);
    this.spool2.position.set(130, -50, 35.6);

    // 3. 4 Teclas Mecânicas de Contacto em Acrílico Fumê Escuro (#0e1118)
    const contactsList = [
      { name: 'WHATSAPP', url: 'https://wa.me/5521982566564', x: -180 },
      { name: 'LINKEDIN', url: 'https://www.linkedin.com/in/camillapaschoal/', x: -60 },
      { name: 'GITHUB', url: 'https://github.com/ccpaschoal', x: 60 },
      { name: 'EMAIL', url: 'mailto:camillacpaschoal@gmail.com', x: 180 }
    ];

    // Dimensões compactas (largura 102, altura 24, profundidade 14) rebaixadas para Y = -122
    const btnGeo = new THREE.BoxGeometry(102, 24, 14);

    contactsList.forEach(item => {
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 512; bCanvas.height = 160;
      const bctx = bCanvas.getContext('2d');

      // Base em acrílico fumê escuro (#0e1118) com chanfro usinado
      bctx.fillStyle = '#0e1118';
      bctx.fillRect(0, 0, 512, 160);
      bctx.strokeStyle = 'rgba(200, 200, 207, 0.30)';
      bctx.lineWidth = 5;
      bctx.strokeRect(3, 3, 506, 154);

      bctx.fillStyle = '#e2e2e8';
      bctx.font = '700 50px "Space Mono", monospace';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText(item.name, 256, 80);

      const bTex = new THREE.CanvasTexture(bCanvas);
      bTex.colorSpace = THREE.SRGBColorSpace;
      bTex.generateMipmaps = true;
      bTex.minFilter = THREE.LinearMipmapLinearFilter;
      bTex.magFilter = THREE.LinearFilter;
      if (this.renderer.capabilities.getMaxAnisotropy) {
        bTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }

      const btnMat = new THREE.MeshStandardMaterial({
        map: bTex,
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.35,
        emissive: new THREE.Color(0x2563eb),
        emissiveIntensity: 0.0
      });

      const btnMesh = new THREE.Mesh(btnGeo, btnMat);
      btnMesh.position.set(item.x, -122, 36);

      btnMesh.userData = {
        isClickable: true,
        url: item.url,
        type: 'contact',
        name: item.name,
        baseZ: 36,
        onHoverStart: () => {
          gsap.to(btnMesh.position, { z: 38, duration: 0.18, ease: 'power2.out' });
          gsap.to(btnMat, { emissiveIntensity: 0.85, duration: 0.18 });
          this.triggerGlitch(180);
        },
        onHoverEnd: () => {
          gsap.to(btnMesh.position, { z: 36, duration: 0.18, ease: 'power2.out' });
          gsap.to(btnMat, { emissiveIntensity: 0.0, duration: 0.18 });
        }
      };

      this.clickableObjects.push(btnMesh);
      this.vhsCassette.add(btnMesh);
    });

    this.vhsCassette.add(vhsBody, labelMesh, this.spool1, this.spool2);

    // 4. Reprodutor VHS com Baia Recuada e Trilhos (estacionado fora de tela à esquerda)
    this.vhsPlayer = new THREE.Group();
    this.vhsPlayer.position.set(-1500, -30, 0);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x0e1118, metalness: 0.38, roughness: 0.66 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x252b35, metalness: 0.5, roughness: 0.37 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x434b58, metalness: 0.72, roughness: 0.26 });
    const deckBody = new THREE.Mesh(new THREE.BoxGeometry(760, 440, 90), caseMat);
    deckBody.position.z = -80;
    const face = new THREE.Mesh(new THREE.BoxGeometry(714, 396, 8), faceMat);
    face.position.z = -30;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(606, 338, 4),
      new THREE.MeshStandardMaterial({ color: 0x030406, roughness: 0.92 }));
    bay.position.z = -23;
    this.vhsPlayer.add(deckBody, face, bay);
    for (const y of [-171, 171]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(620, 13, 18), railMat);
      rail.position.set(0, y, 38);
      this.vhsPlayer.add(rail);
    }
    for (const x of [-307, 307]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(13, 342, 18), railMat);
      rail.position.set(x, 0, 38);
      this.vhsPlayer.add(rail);
    }

    // 5. Display CRT Superior do Deck (fósforo ciano/verde, scanlines e LED com luz física sem corte)
    const deckCanvas = document.createElement('canvas');
    deckCanvas.width = 1024; deckCanvas.height = 140;
    const dctx = deckCanvas.getContext('2d');
    dctx.fillStyle = '#050b14';
    dctx.fillRect(0, 0, 1024, 140);

    // Linhas de scanlines horizontais estáticas discretas
    dctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    for (let y = 0; y < 140; y += 3) {
      dctx.fillRect(0, y, 1024, 1);
    }

    dctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    dctx.lineWidth = 3;
    dctx.strokeRect(3, 3, 1018, 134);

    dctx.fillStyle = '#38bdf8';
    dctx.font = '700 32px "Space Mono", monospace';
    dctx.fillText('PASCHOAL T-120 · MASTER DECK', 28, 48);

    dctx.fillStyle = '#4ade80';
    dctx.font = '700 28px "Space Mono", monospace';
    dctx.fillText('▶ PLAY  SP  STEREO  CH-1/2', 28, 92);

    dctx.fillStyle = '#38bdf8';
    dctx.font = '700 36px "Space Mono", monospace';
    dctx.fillText('00:26:14', 775, 70);

    const deckTex = new THREE.CanvasTexture(deckCanvas);
    deckTex.colorSpace = THREE.SRGBColorSpace;
    deckTex.generateMipmaps = true;
    deckTex.minFilter = THREE.LinearMipmapLinearFilter;
    deckTex.magFilter = THREE.LinearFilter;
    if (this.renderer.capabilities.getMaxAnisotropy) {
      deckTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    const deckTitle = new THREE.Mesh(new THREE.PlaneGeometry(480, 65),
      new THREE.MeshBasicMaterial({ map: deckTex, transparent: true }));
    // Posicionado no topo frontal do deck (Z=46 evita qualquer corte pelo trilho em Z=38; Y=230 eleva o display com folga)
    deckTitle.position.set(-65, 230, 46);
    this.vhsPlayer.add(deckTitle);

    this.deckStatusLight = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.2
    });
    // Bolinha LED maior (raio ampliado para 13 com malha de alta resolução)
    const led = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), this.deckStatusLight);
    led.position.set(315, 230, 46);

    const ledLight = new THREE.PointLight(0x38bdf8, 2.0, 140);
    ledLight.position.set(315, 230, 56);
    this.vhsPlayer.add(led, ledLight);

    this.chapter03Group.add(this.vhsPlayer, this.vhsCassette);
  }

  /* ==========================================================================
     MASTER TIMELINE GSAP NARRATIVA (PROGRESSO VIRTUAL 0.0 A 1.0)
     ========================================================================== */
  initMasterTimeline() {
    this.masterTimeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        if (document.body.classList.contains('is-teaser')) return;
        const time = this.masterTimeline.time();
        const overlap = !this.reducedMotion.matches;
        this.chapter00Group.visible = time < (overlap ? 27.5 : 25);
        this.chapter01Group.visible = time >= (overlap ? 22 : 25) && time < 49.5;
        this.chapter02Group.visible = time >= 48 && time < 75;
        this.chapter03Group.visible = time >= 75;

        // Ao sair da tela preta e avançar na narrativa, garante poeira dissipada
        if (this.dustMaterial && this.dustMaterial.uniforms.uOpacity.value > 0 && !this.teaserTimeline?.isActive()) {
          this.dustMaterial.uniforms.uWind.value = 1.0;
          this.dustMaterial.uniforms.uOpacity.value = 0.0;
        }
      }
    });

    // --- ATO 00: POLAROIDS (0.00 a 0.25 -> 0s a 25s) ---
    // Resposta imediata ao scroll: a partir de 3s as cartas iniciam a elevação suave e recuo em profundidade
    this.masterTimeline.to(this.chapter00Group.position, { z: -420, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.leftPolaroid.position, { y: 1150, x: -390, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.rightPolaroid.position, { y: 1150, x: 390, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.centerPolaroid.position, { y: 1200, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.leftPolaroid.rotation, { z: -0.16, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.rightPolaroid.rotation, { z: 0.16, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    // Opacidade desvanece suavemente de 20.5s a 26.5s
    this.masterTimeline.to(this.polaroidMaterials, { opacity: 0, duration: 6.0, ease: 'power1.inOut', immediateRender: false }, 20.5);

    // --- ATO 01: CARROSSÉIS FLUTUANTES (0.25 a 0.48 -> 25s a 48s) ---
    if (!this.reducedMotion.matches) {
      // Aproximação em Z e escala contínuos do conjunto centralizado (21s a 29.5s)
      this.masterTimeline.fromTo(this.kodakFilmStrip.position,
        { z: -360, x: -440, y: -12 },
        { z: 0, x: -440, y: 0, duration: 8.5, ease: 'power2.out', immediateRender: false }, 21.0);
      this.masterTimeline.fromTo(this.kodakFilmStrip.scale,
        { x: 0.76, y: 0.76, z: 0.76 },
        { x: 1, y: 1, z: 1, duration: 8.5, ease: 'power2.out', immediateRender: false }, 21.0);

      // 6 cantos e trajetórias calibradas fora da tela para as lâminas da Apresentação
      const slideCorners = [
        // 0: Apresentação 1 (Fora da tela alto-esquerda -> centro)
        { inPos: [-1100, 720, -220], inRot: [0.12, -0.20, 0.10], outPos: [-750, -520, -180], outRot: [-0.12, 0.15, -0.08] },
        // 1: Apresentação 2 (Fora da tela baixo-esquerda -> centro)
        { inPos: [-1000, -700, -200], inRot: [-0.10, -0.18, -0.08], outPos: [-680, 520, -160], outRot: [0.12, -0.12, 0.08] },
        // 2: Apresentação 3 (Fora da tela alto-centro -> centro)
        { inPos: [-200, 760, -250], inRot: [0.16, 0.04, -0.08], outPos: [650, 540, -180], outRot: [0.10, 0.14, 0.08] },
        // 3: Apresentação 4 (Fora da tela baixo-centro -> centro)
        { inPos: [200, -760, -230], inRot: [-0.16, -0.04, 0.08], outPos: [720, -520, -160], outRot: [-0.12, 0.12, -0.08] },
        // 4: Apresentação 5 (Fora da tela alto-direita -> centro)
        { inPos: [1000, 700, -200], inRot: [0.10, 0.20, -0.08], outPos: [220, 560, -180], outRot: [0.14, -0.08, 0.06] },
        // 5: Apresentação 6 (Fora da tela baixo-direita -> centro)
        { inPos: [1100, -720, -220], inRot: [-0.12, 0.18, 0.10], outPos: [-220, -560, -180], outRot: [-0.14, 0.08, -0.06] }
      ];

      // 1. ENTRADA DEVAGAR, NOBRE & MONTAGEM EM ORDEM NO MEIO DA TELA (21.0s a 31.0s)
      if (this.filmSlides && this.filmSlides.length) {
        const dur = 8.0; // Voo calmo, lento e cadenciado de 8.0s (sem saltos)
        this.filmSlides.forEach((slide, i) => {
          const c = slideCorners[i] || slideCorners[0];
          const startT = 21.0 + i * 0.40;

          const startX = slide.userData.baseX + c.inPos[0];
          const startY = c.inPos[1];
          const startZ = slide.userData.baseZ + c.inPos[2];
          const startRotY = slide.userData.baseRotY + c.inRot[1];
          const startRotX = c.inRot[0];
          const startRotZ = c.inRot[2];

          // Posiciona todas as lâminas fora de tela às 21.0s com opacidade 0 (sem snap)
          this.masterTimeline.set(slide.position, { x: startX, y: startY, z: startZ }, 21.0);
          this.masterTimeline.set(slide.rotation, { x: startRotX, y: startRotY, z: startRotZ }, 21.0);
          this.masterTimeline.set(slide.material, { opacity: 0.0 }, 21.0);

          // Entrada: voam com calma de fora da tela e unem-se perfeitamente no centro
          this.masterTimeline.to(slide.position,
            { x: slide.userData.baseX, y: 0, z: slide.userData.baseZ, duration: dur, ease: 'power2.out', immediateRender: false },
            startT
          );
          this.masterTimeline.to(slide.rotation,
            { x: 0.0, y: slide.userData.baseRotY, z: 0.0, duration: dur, ease: 'power2.out', immediateRender: false },
            startT
          );
          this.masterTimeline.to(slide.material,
            { opacity: 1.0, duration: 5.2, ease: 'power1.out', immediateRender: false },
            startT
          );

          // 2. SAÍDA SUAVE E GRADUAL FORA DA TELA (38.5s a 48.5s): dispersão lenta e sem aceleração brusca
          const exitT = 38.5 + i * 0.35;
          const exitDur = 8.5; // Duração longa e serena de 8.5s (elimina o efeito de "ser atirado")
          const exitX = slide.userData.baseX + c.outPos[0];
          const exitY = c.outPos[1];
          const exitZ = slide.userData.baseZ + c.outPos[2];

          this.masterTimeline.to(slide.position, {
            x: exitX,
            y: exitY,
            z: exitZ,
            duration: exitDur,
            ease: 'sine.inOut',
            immediateRender: false
          }, exitT);
          this.masterTimeline.to(slide.rotation, {
            x: c.outRot[0],
            y: slide.userData.baseRotY + c.outRot[1],
            z: c.outRot[2],
            duration: exitDur,
            ease: 'sine.inOut',
            immediateRender: false
          }, exitT);
          this.masterTimeline.to(slide.material, {
            opacity: 0.0,
            duration: 6.5,
            ease: 'power1.inOut',
            immediateRender: false
          }, exitT);
        });
      }
    }
    this.masterTimeline.to(this.filmRimLight, { intensity: 4.5, duration: 4, immediateRender: false }, 22);

    // Suave deriva contemplativa para apreciação da imagem montada no centro da tela (29.0s a 38.5s)
    this.masterTimeline.to(this.kodakFilmStrip.position, {
      x: -470,
      duration: 9.5,
      ease: 'none',
      immediateRender: false
    }, 29.0);
    this.masterTimeline.to(this.filmRimLight, { intensity: 0.0, duration: 3.5, immediateRender: false }, 45.0);

    // --- ATO 02: SMARTPHONE HERO ÚNICO (0.48 a 0.76 -> 48s a 76s) ---
    this.masterTimeline.to(this.phoneRimLight, { intensity: 1.4, duration: 4, immediateRender: false }, 48);

    // A. Entrada cinematográfica: surge majestosamente do fundo profundo (48s a 55s)
    this.masterTimeline.fromTo(this.phoneHero.position,
      { x: 0, y: -60, z: -900 },
      { x: 0, y: 10, z: 40, duration: 7, ease: 'power2.out', immediateRender: false },
      48
    );
    this.masterTimeline.fromTo(this.phoneHero.scale,
      { x: 0.08, y: 0.08, z: 0.08 },
      { x: 1.0, y: 1.0, z: 1.0, duration: 7, ease: 'power2.out', immediateRender: false },
      48
    );
    this.masterTimeline.fromTo(this.phoneHero.rotation,
      { x: 0.12, y: -0.28, z: 0.02 },
      { x: 0.03, y: -0.14, z: 0.01, duration: 7, ease: 'power2.out', immediateRender: false },
      48
    );
    this.masterTimeline.fromTo(this.phoneMaterials,
      { opacity: 0.0 },
      { opacity: 1.0, duration: 4.5, ease: 'power2.out', immediateRender: false },
      48
    );
    this.masterTimeline.fromTo(this.phoneFrontGlassMat,
      { opacity: 0.0 },
      { opacity: 0.08, duration: 4.5, ease: 'power2.out', immediateRender: false },
      48
    );

    // B. Platô de estabilidade / leitura fixa no centro (55s a 71s):
    // O telemóvel permanece FIRME no centro da tela para inspeção do site e uso das setas de projeto.

    // C. Saída cinematográfica: recuo suave que completa a transição para o VHS (71s a 74.9s)
    this.masterTimeline.to(this.phoneHero.position, {
      x: 0,
      y: -40,
      z: -700,
      duration: 3.9,
      ease: 'power2.in',
      immediateRender: false
    }, 71);
    this.masterTimeline.to(this.phoneHero.scale, {
      x: 0.15,
      y: 0.15,
      z: 0.15,
      duration: 3.9,
      ease: 'power2.in',
      immediateRender: false
    }, 71);
    this.masterTimeline.to(this.phoneHero.rotation, {
      x: 0.12,
      y: -0.28,
      z: 0.02,
      duration: 3.9,
      ease: 'power2.in',
      immediateRender: false
    }, 71);

    // Desvanecimento completo dos materiais até opacidade 0 sincronizado com a chegada do Ato 03
    this.masterTimeline.to(this.phoneMaterials, {
      opacity: 0.0,
      duration: 3.2,
      ease: 'power2.in',
      immediateRender: false
    }, 71.7);
    this.masterTimeline.to(this.phoneFrontGlassMat, {
      opacity: 0.0,
      duration: 3.2,
      ease: 'power2.in',
      immediateRender: false
    }, 71.7);

    this.masterTimeline.to(this.phoneRimLight, { intensity: 0.0, duration: 3.0, immediateRender: false }, 72);

    // --- ATO 03: VHS DECK (0.75 a 1.00 -> 75s a 100s) ---
    // O frame/reprodutor vem direto do canto esquerdo fora de tela (X=-1500) deslizando suavemente até o centro
    this.masterTimeline.fromTo(this.vhsPlayer.position,
      { x: -1500, y: -30, z: 0 },
      { x: 0, y: -30, z: 0, duration: 4.8, ease: 'power2.out', immediateRender: false },
      74.8
    );
    this.masterTimeline.fromTo(this.vhsPlayer.rotation,
      { y: 0.12, z: -0.01 },
      { y: 0, z: 0, duration: 4.8, ease: 'power2.out', immediateRender: false },
      74.8
    );

    // A fita cassete em si mantém sua velocidade solene e cadenciada (13.8s) para encaixar com precisão mecânica
    this.masterTimeline.fromTo(this.vhsCassette.position,
      { x: 0, y: -720, z: 240 },
      { x: 0, y: -30, z: 0, duration: 13.8, ease: 'power1.inOut' },
      76
    );
    this.masterTimeline.fromTo(this.vhsCassette.rotation,
      { x: -0.22, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, duration: 13.8, ease: 'power1.inOut' },
      76
    );
    this.masterTimeline.to(this.deckStatusLight, { opacity: 1, duration: 1.5 }, 89.0);
    // Sustenta o último quadro até 100s para manter os quatro atos com 25s cada.
    this.masterTimeline.to(this.chapter03Group.position, { y: 0, z: 0, duration: 7 }, 93);
  }

  /* ==========================================================================
     TRANSIÇÃO DO TEASER: SUBIDA DO MAÇO E ABERTURA EM LEQUE
     ========================================================================== */
  triggerTeaserReveal() {
    if (this.currentChapter >= 0 || this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentChapter = 0;

    // Estado inicial: empilhadas em maço no rodapé profundo sem solavancos
    this.leftPolaroid.position.set(0, -650, 0);
    this.leftPolaroid.rotation.set(0, 0, 0.02);

    this.rightPolaroid.position.set(0, -650, 5);
    this.rightPolaroid.rotation.set(0, 0, -0.02);

    this.centerPolaroid.position.set(0, -650, 15);
    this.centerPolaroid.rotation.set(0, 0, 0.005);

    this.chapter00Group.rotation.set(0, 0, 0);
    this.chapter00Group.visible = true;

    this.teaserTimeline = gsap.timeline({
      onComplete: () => {
        this.currentChapter = 0;
        this.isTransitioning = false;
        if (this.masterTimeline) {
          this.masterTimeline.pause();
          this.masterTimeline.progress(0);
        }
      }
    });

    const tl = this.teaserTimeline;

    // Subida suave e contínua surgindo da esquerda para a direita (stagger orgânico)
    tl.to(this.leftPolaroid.position, { y: -12, z: -15, duration: 1.15, ease: 'power2.out' }, 0);
    tl.to(this.centerPolaroid.position, { y: 12, z: 35, duration: 1.15, ease: 'power2.out' }, 0.08);
    tl.to(this.rightPolaroid.position, { y: -12, z: -15, duration: 1.15, ease: 'power2.out' }, 0.16);

    // Desdobramento gradual em leque da esquerda para a direita com respiro amplo de 65px
    tl.to(this.leftPolaroid.position, { x: -395, duration: 0.90, ease: 'power2.out' }, 0.20);
    tl.to(this.leftPolaroid.rotation, { z: -0.09, y: 0.12, duration: 0.90, ease: 'power2.out' }, 0.20);

    tl.to(this.centerPolaroid.rotation, { z: 0.005, y: 0.0, duration: 0.90, ease: 'power2.out' }, 0.28);

    tl.to(this.rightPolaroid.position, { x: 395, duration: 0.90, ease: 'power2.out' }, 0.36);
    tl.to(this.rightPolaroid.rotation, { z: 0.09, y: -0.12, duration: 0.90, ease: 'power2.out' }, 0.36);

    // Vento ascendente jogando a poeira para cima e dissipando ao sair da página preta
    if (this.dustMaterial) {
      tl.to(this.dustMaterial.uniforms.uWind, {
        value: 1.0,
        duration: 1.35,
        ease: 'power2.in'
      }, 0);
      tl.to(this.dustMaterial.uniforms.uOpacity, {
        value: 0.0,
        duration: 1.15,
        ease: 'power2.out'
      }, 0.15);
    }

    if (this.reducedMotion.matches) tl.progress(1);
  }

  /* ==========================================================================
     RETORNO AO PRÓLOGO / TELA PRETA (TEASER) AO VOLTAR A ROLAGEM
     ========================================================================== */
  hideToTeaser(onComplete) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.teaserTimeline?.isActive()) {
      this.teaserTimeline.kill();
    }

    this.teaserTimeline = gsap.timeline({
      onComplete: () => {
        this.chapter00Group.visible = false;
        this.currentChapter = -1;
        this.isTransitioning = false;
        if (this.masterTimeline) {
          this.masterTimeline.pause(0);
        }
        if (onComplete) onComplete();
      }
    });

    const tl = this.teaserTimeline;

    // 1. Fecha o leque para o centro (direita primeiro, depois centro, depois esquerda)
    tl.to(this.rightPolaroid.position, { x: 0, duration: 0.55, ease: 'power2.in' }, 0);
    tl.to(this.rightPolaroid.rotation, { z: -0.02, y: 0, duration: 0.55, ease: 'power2.in' }, 0);

    tl.to(this.centerPolaroid.rotation, { z: 0.005, y: 0, duration: 0.55, ease: 'power2.in' }, 0.08);

    tl.to(this.leftPolaroid.position, { x: 0, duration: 0.55, ease: 'power2.in' }, 0.16);
    tl.to(this.leftPolaroid.rotation, { z: 0.02, y: 0, duration: 0.55, ease: 'power2.in' }, 0.16);

    // 2. Desce o maço empilhado para y: -650 no rodapé profundo
    tl.to(this.rightPolaroid.position, { y: -650, z: 5, duration: 0.65, ease: 'power2.in' }, 0.25);
    tl.to(this.centerPolaroid.position, { y: -650, z: 15, duration: 0.65, ease: 'power2.in' }, 0.28);
    tl.to(this.leftPolaroid.position, { y: -650, z: 0, duration: 0.65, ease: 'power2.in' }, 0.32);

    // Retorno suave da poeira: vento cessa e partículas reassentam pacificamente na página preta
    if (this.dustMaterial) {
      tl.to(this.dustMaterial.uniforms.uWind, {
        value: 0.0,
        duration: 0.95,
        ease: 'power2.out'
      }, 0.20);
      tl.to(this.dustMaterial.uniforms.uOpacity, {
        value: 1.0,
        duration: 1.05,
        ease: 'power2.out'
      }, 0.10);
    }

    if (this.reducedMotion.matches) tl.progress(1);
  }

  /* ==========================================================================
     INTERATIVIDADE TÁTIL COM RAYCASTER
     ========================================================================== */
  checkHover(clientX, clientY) {
    this.ndc.set((clientX / this.width) * 2 - 1, -(clientY / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const activeVisibleCandidates = this.clickableObjects.filter(obj => {
      let cur = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    });

    const intersects = this.raycaster.intersectObjects(activeVisibleCandidates, true);
    let hit = null;

    if (intersects.length > 0) {
      let cur = intersects[0].object;
      while (cur && !cur.userData?.isClickable) {
        cur = cur.parent;
      }
      if (cur && cur.userData?.isClickable) {
        hit = cur;
      }
    }

    if (hit !== this.hoveredObject) {
      if (this.hoveredObject && typeof this.hoveredObject.userData?.onHoverEnd === 'function') {
        this.hoveredObject.userData.onHoverEnd();
      }
      this.hoveredObject = hit;
      if (this.hoveredObject && typeof this.hoveredObject.userData?.onHoverStart === 'function') {
        this.hoveredObject.userData.onHoverStart();
      }
    }

    return hit;
  }

  triggerGlitch(durationMs = 180) {
    this.glitchUntil = performance.now() + durationMs;
    this.isGlitching = true;
  }

  handleClick(clientX, clientY) {
    const hit = this.checkHover(clientX, clientY);
    if (hit && hit.userData?.url) {
      const url = hit.userData.url;
      const baseZ = hit.userData.baseZ !== undefined ? hit.userData.baseZ : hit.position.z;
      // Micro-afundamento mecânico de 120ms (ease: 'power2.inOut')
      gsap.to(hit.position, {
        z: baseZ - 3,
        duration: 0.06,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          hit.position.z = baseZ;
        }
      });
      if (url.startsWith('mailto:')) {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return true;
    }
    return false;
  }

  updateResponsiveLayout() {
    const aspect = this.width / this.height;
    const visibleWidth = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect;
    if (this.chapter00Group) {
      this.chapter00Group.scale.setScalar(Math.min(1, (visibleWidth * 0.88) / 1010));
    }
    if (this.chapter01Group) {
      this.chapter01Group.scale.setScalar(Math.min(1, (visibleWidth * 0.92) / 780));
    }
    if (this.chapter02Group) this.chapter02Group.scale.setScalar(Math.min(1, (visibleWidth * 0.85) / 250));
    if (this.chapter03Group) this.chapter03Group.scale.setScalar(Math.min(1, (visibleWidth * 0.88) / 800));
  }

  updateMouseCoordinates(clientX, clientY) {
    // Coordenadas normalizadas para Mouse Parallax / Tilt
    this.mouseNormX = (clientX / this.width) * 2 - 1;
    this.mouseNormY = -(clientY / this.height) * 2 + 1;

    if (!this.dustMaterial) return;
    this._ndc3.set(this.mouseNormX, this.mouseNormY, 0.5);
    this._ndc3.unproject(this.camera);
    this._dir.subVectors(this._ndc3, this.camera.position).normalize();
    const dist = (this.planeDepth - this.camera.position.z) / this._dir.z;
    this.vMouse3D.copy(this.camera.position).addScaledVector(this._dir, dist);

    const u = this.dustMaterial.uniforms.uMouse.value;
    if (u.x > 5000) {
      u.copy(this.vMouse3D);
    } else {
      u.lerp(this.vMouse3D, 0.35);
    }
  }

  bindEvents() {
    this._onResize = () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      this.updateResponsiveLayout();
    };
    window.addEventListener('resize', this._onResize);
  }

  unbindEvents() {
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());
    if (document.hidden) return;

    if (this.dustMaterial) {
      if (!this.reducedMotion.matches) this.dustMaterial.uniforms.uTime.value += 0.012;
      const u = this.dustMaterial.uniforms.uMouse.value;
      if (u.x < 5000) {
        u.lerp(this.vMouse3D, 0.15);
      }
    }

    // Inclinação 3D tátil e independente para cada Polaroid solta no espaço (Capítulo 00)
    if (this.chapter00Group && this.chapter00Group.visible && !this.reducedMotion.matches) {
      const mx = this.mouseNormX || 0;
      const my = this.mouseNormY || 0;
      const t = performance.now() * 0.001;

      // O grupo permanece fixo em rotação 0 para que as cartas não se inclinem em bloco rígido
      this.chapter00Group.rotation.set(0, 0, 0);

      // Cada polaroid inclina independentemente com sua própria rotação e sensibilidade tátil
      if (this.centerPolaroid) {
        this.centerPolaroid.rotation.y = THREE.MathUtils.lerp(this.centerPolaroid.rotation.y, mx * 0.10, 0.06);
        this.centerPolaroid.rotation.x = THREE.MathUtils.lerp(this.centerPolaroid.rotation.x, -my * 0.08, 0.06);
      }
      if (this.leftPolaroid) {
        this.leftPolaroid.rotation.y = THREE.MathUtils.lerp(this.leftPolaroid.rotation.y, 0.12 + mx * 0.08, 0.06);
        this.leftPolaroid.rotation.x = THREE.MathUtils.lerp(this.leftPolaroid.rotation.x, -my * 0.07 + Math.sin(t * 1.1) * 0.005, 0.06);
      }
      if (this.rightPolaroid) {
        this.rightPolaroid.rotation.y = THREE.MathUtils.lerp(this.rightPolaroid.rotation.y, -0.12 + mx * 0.08, 0.06);
        this.rightPolaroid.rotation.x = THREE.MathUtils.lerp(this.rightPolaroid.rotation.x, -my * 0.07 + Math.cos(t * 1.2) * 0.005, 0.06);
      }
    }

    // Flutuação orgânica solta das lâminas fotográficas no espaço (Ato 01)
    if (this.filmSlides && this.chapter01Group?.visible && !this.reducedMotion.matches) {
      const time = this.masterTimeline ? this.masterTimeline.time() : 30;
      // Flutuação sutil de respiração apenas enquanto as lâminas estão montadas e estáveis no centro (25.5s a 42.5s)
      if (time >= 25.5 && time <= 42.5) {
        const t = performance.now() * 0.001;
        const my = this.mouseNormY || 0;
        for (let i = 0; i < this.filmSlides.length; i++) {
          const slide = this.filmSlides[i];
          const floatY = Math.sin(t * 1.3 + i * 0.72) * 2.2;
          const floatRotZ = Math.sin(t * 1.0 + i * 0.58) * 0.008;
          slide.position.y = (slide.userData.baseY || 0) + floatY;
          slide.rotation.z = (slide.userData.baseRotZ || 0) + floatRotZ;
          slide.rotation.x = -my * 0.025;
        }
      }
    }

    // Mouse Parallax 3D Tátil no Smartphone (Ato 02) com reflexos dinâmicos nos aros e vidro
    if (this.chapter02Group && this.chapter02Group.visible && !this.reducedMotion.matches) {
      this.chapter02Group.rotation.y = THREE.MathUtils.lerp(
        this.chapter02Group.rotation.y,
        (this.mouseNormX || 0) * 0.10,
        0.06
      );
      this.chapter02Group.rotation.x = THREE.MathUtils.lerp(
        this.chapter02Group.rotation.x,
        -(this.mouseNormY || 0) * 0.08,
        0.06
      );
    }

    // Rotação suave das bobinas do VHS (em torno do eixo central Z de visualização)
    if (this.spool1 && this.spool2 && !this.reducedMotion.matches) {
      this.spool1.rotation.z += 0.02;
      this.spool2.rotation.z += 0.02;
    }

    // Controle reativo de tracking glitch analógico do rótulo da fita VHS
    const now = performance.now();
    if (this.chapter03Group?.visible && now > this.nextRandomGlitchTime) {
      this.triggerGlitch(180);
      this.nextRandomGlitchTime = now + 6000 + Math.random() * 2000;
    }

    if (this.isGlitching && this.vhsLabelCanvas && this.cleanLabelCanvas) {
      if (now < this.glitchUntil) {
        const ctx = this.vhsLabelCtx;
        const w = this.vhsLabelCanvas.width;
        const h = this.vhsLabelCanvas.height;
        ctx.drawImage(this.cleanLabelCanvas, 0, 0);

        // 2 a 3 faixas horizontais com micro-deslocamento (jitter / scanlines)
        const slices = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < slices; i++) {
          const sy = Math.floor(Math.random() * (h - 60));
          const sh = 20 + Math.floor(Math.random() * 40);
          const dx = (Math.random() - 0.5) * 32;
          ctx.drawImage(this.cleanLabelCanvas, 0, sy, w, sh, dx, sy, w, sh);

          // Linha de ruído e tracking
          ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)';
          ctx.fillRect(0, sy, w, 3);
        }
        this.vhsLabelTexture.needsUpdate = true;
      } else {
        // Restauração do rótulo 100% limpo, nítido e legível
        this.vhsLabelCtx.drawImage(this.cleanLabelCanvas, 0, 0);
        this.vhsLabelTexture.needsUpdate = true;
        this.isGlitching = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.masterTimeline) this.masterTimeline.kill();
    if (this.teaserTimeline) this.teaserTimeline.kill();
    this.unbindEvents();

    this.scene.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const key of Object.keys(m)) {
            const prop = m[key];
            if (prop && typeof prop === 'object' && typeof prop.dispose === 'function') {
              prop.dispose();
            }
          }
          m.dispose();
        }
      }
    });

    if (this.dustGeometry) this.dustGeometry.dispose();
    if (this.dustMaterial) this.dustMaterial.dispose();
    if (this.vhsLabelTexture) this.vhsLabelTexture.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
