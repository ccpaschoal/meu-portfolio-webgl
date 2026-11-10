import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sitesData } from './data/sites.js';
import { spiralSlidesData } from './data/spiralSlides.js';
import { getAssetUrl } from './utils/assets.js';

/**
 * PORTFÓLIO WEBGL NATIVO — CAMILLA PASCHOAL
 * Narrativa Contínua em 4 Atos:
 * 00 / MATRIZ: Tríptico de Polaroids com desdobramento em leque
 * 01 / DIGITAL: 4 Smartphones 3D em carrossel circular com profundidade da frente para trás
 * 02 / ESPIRAL: Escada em Espiral 3D dos Carrosséis (Camilla, AURA e Vanessa Chaves)
 * 03 / CONTATO: Mockups de Browser Flutuando & Tipografia "ADAPTÁVEL. DO SEU JEITO."
 */

// Hélice do Ato 02: raio, descida por lâmina e giro por lâmina (~30°)
// depth: recuo do eixo da hélice em z (a lâmina da frente fica em z = radius + depth)
const SPIRAL = { radius: 520, pitch: 140, angleStep: 0.52, depth: -330 };

// Carrega uma única vez as webfonts usadas nos textos desenhados em canvas.
// O primeiro desenho pode sair com fonte de sistema; quando a promessa resolve, os canvases são redesenhados.
let canvasFontsPromise = null;
function canvasFontsReady() {
  if (!canvasFontsPromise) {
    const faces = [
      '400 22px "Space Mono"', '700 44px "Space Mono"',
      '400 36px "Inter"', '600 30px "Inter"', '700 48px "Inter"', '800 64px "Inter"'
    ];
    canvasFontsPromise = typeof document !== 'undefined' && document.fonts
      ? Promise.all(faces.map(f => document.fonts.load(f))).then(() => document.fonts.ready).catch(() => {})
      : Promise.resolve();
  }
  return canvasFontsPromise;
}

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

    this._disposed = false;
    this.spiralTexturesRequested = false;

    this.initRenderer();
    this.initScene();
    this.initLighting();

    // 1. Poeira Dual-Tone Reativa (6.500 partículas)
    this.buildDualToneDust();

    // 2. Os 4 Atos Narrativos
    this.buildChapter00(); // Tríptico de Polaroids
    this.buildChapter01(); // 4 Smartphones 3D em Carrossel Circular com Profundidade
    this.buildChapter02(); // Escada em Espiral 3D dos Carrosséis (Helix 3D)
    this.buildChapter03(); // Mockups de Browser Flutuando & "Adaptável. Do seu jeito."
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
    const room = new RoomEnvironment();
    this.envRenderTarget = pmrem.fromScene(room, 0.04);
    this.envMap = this.envRenderTarget.texture;
    room.dispose?.();
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

    // [grupo, força em Y, força em X] do parallax do mouse por ato
    this.parallaxGroups = [
      [this.chapter01Group, 0.10, 0.08],
      [this.chapter02Group, 0.06, 0.05],
      [this.chapter03Group, 0.05, 0.04]
    ];
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

    // Luz de recorte da espiral de carrosséis do Ato 02 (#a5b4fc)
    this.spiralRimLight = new THREE.SpotLight(0xa5b4fc, 0.0, 3400, Math.PI / 4, 0.35, 1.2);
    this.spiralRimLight.position.set(250, 380, -180);
    this.spiralRimLight.target.position.set(0, 0, 0);
    this.scene.add(this.spiralRimLight, this.spiralRimLight.target);

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
    const drawLeft = () => {
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
    };
    drawLeft();

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
    const drawRight = () => {
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
    };
    drawRight();

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

    // Redesenha os textos das polaroids com as webfonts definitivas
    canvasFontsReady().then(() => {
      if (this._disposed) return;
      drawLeft();
      leftTex.needsUpdate = true;
      drawRight();
      rightTex.needsUpdate = true;
    });

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
     ATO 01: 4 SMARTPHONES 3D EM CARROSSEL CIRCULAR COM PROFUNDIDADE
     ========================================================================== */
  buildChapter01() {
    this.activeSiteIndex = 0;
    this.carouselAngle = 0;
    this.carouselState = { angle: 0 };
    this.mockups = [];
    this.mockupMaterials = [];
    this.carouselRingGroup = new THREE.Group();

    // 1. Canvases e texturas independentes para cada um dos 4 sites
    this.siteScreenCanvases = [];
    this.siteScreenTextures = [];
    this.siteImages = sitesData.map((site, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 780;
      canvas.height = 1688;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0b0e16';
        ctx.fillRect(0, 0, 780, 1688);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (this.renderer.capabilities.getMaxAnisotropy) {
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }

      this.siteScreenCanvases.push(canvas);
      this.siteScreenTextures.push(texture);

      const image = new Image();
      image.onload = () => {
        if (ctx) {
          ctx.drawImage(image, 0, 0, 780, 1688);
          texture.needsUpdate = true;
        }
      };
      image.src = getAssetUrl(site.image || site.thumb);
      return image;
    });

    // Compatibilidade com referências legadas
    this.siteScreenCanvas = this.siteScreenCanvases[0];
    this.siteScreenCtx = this.siteScreenCanvas.getContext('2d');
    this.siteScreenTexture = this.siteScreenTextures[0];

    // 2. Geometrias compartilhadas dos mockups (alta performance e baixo overhead de memória)
    const PHONE_W = 208;
    const PHONE_H = 446;
    const PHONE_D = 14;
    const BEVEL = 3.0;
    const SCREEN_W = 196;
    const SCREEN_H = 424.2; // 196 * (1688 / 780) proporção 1:1 exata

    const chassisGeo = new THREE.ExtrudeGeometry(roundedRectShape(PHONE_W, PHONE_H, 25), {
      depth: PHONE_D,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: BEVEL,
      bevelThickness: BEVEL
    });
    chassisGeo.center();

    const screenGeo = roundedRectGeometry(SCREEN_W, SCREEN_H, 19);
    const pillGeo = roundedRectGeometry(44, 13, 6.5);
    const selfieLensGeo = new THREE.CircleGeometry(2.8, 16);
    const glassGeo = roundedRectGeometry(SCREEN_W + 2, SCREEN_H + 2, 20);
    const backGeo = roundedRectGeometry(PHONE_W - 2, PHONE_H - 2, 24);

    const islandGeo = new THREE.ExtrudeGeometry(roundedRectShape(88, 92, 19), {
      depth: 3.2,
      bevelEnabled: true,
      bevelSize: 1.6,
      bevelThickness: 1.6,
      bevelSegments: 3
    });
    islandGeo.center();

    const ringGeo = new THREE.CylinderGeometry(15, 15, 3.8, 32);
    const lensGlassGeo = new THREE.CircleGeometry(12.8, 32);
    const flashGeo = new THREE.CircleGeometry(5.5, 20);
    const lidarGeo = new THREE.CircleGeometry(6.0, 20);

    const powerBtnGeo = new THREE.BoxGeometry(2.4, 52, 5.5);
    const volUpGeo = new THREE.BoxGeometry(2.4, 34, 5.5);
    const volDownGeo = new THREE.BoxGeometry(2.4, 34, 5.5);
    const actionBtnGeo = new THREE.BoxGeometry(2.4, 19, 5.5);
    const usbcGeo = new THREE.BoxGeometry(17, 4.8, 2);

    // 3. Materiais compartilhados
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x363a46,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 2.2,
      transparent: true,
      opacity: 1.0
    });
    const pillMat = new THREE.MeshBasicMaterial({ color: 0x020306, transparent: true, opacity: 1.0 });
    const selfieMat = new THREE.MeshBasicMaterial({ color: 0x08182c, transparent: true, opacity: 1.0 });
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
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x181a22,
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 1.0
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5a6072,
      metalness: 0.95,
      roughness: 0.12,
      transparent: true,
      opacity: 1.0
    });
    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x08101e,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 1.0
    });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 1.0 });
    const lidarMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 1.0 });
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x4e5362,
      metalness: 0.94,
      roughness: 0.18,
      transparent: true,
      opacity: 1.0
    });
    const usbcMat = new THREE.MeshBasicMaterial({ color: 0x06070a, transparent: true, opacity: 1.0 });

    this.mockupMaterials = [
      titaniumMat, pillMat, selfieMat, frontGlassMat, backMat,
      ringMat, lensGlassMat, flashMat, lidarMat, btnMat, usbcMat
    ];

    const lensCoords = [
      { dx: -21, dy: 22 },
      { dx: -21, dy: -22 },
      { dx: 23, dy: 0 }
    ];

    // 4. Constrói os 4 mockups em 3D
    sitesData.forEach((site, i) => {
      const mockup = new THREE.Group();

      const chassis = new THREE.Mesh(chassisGeo, titaniumMat);
      mockup.add(chassis);

      const screenMat = new THREE.MeshBasicMaterial({
        map: this.siteScreenTextures[i],
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        transparent: true,
        opacity: 1.0
      });
      this.mockupMaterials.push(screenMat);

      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(0, 0, PHONE_D / 2 + BEVEL + 0.1);
      mockup.add(screen);

      const pill = new THREE.Mesh(pillGeo, pillMat);
      pill.position.set(0, SCREEN_H / 2 - 20, PHONE_D / 2 + BEVEL + 0.2);
      const selfie = new THREE.Mesh(selfieLensGeo, selfieMat);
      selfie.position.set(10, SCREEN_H / 2 - 20, PHONE_D / 2 + BEVEL + 0.25);
      mockup.add(pill, selfie);

      const glassFront = new THREE.Mesh(glassGeo, frontGlassMat);
      glassFront.position.set(0, 0, PHONE_D / 2 + BEVEL + 0.35);
      mockup.add(glassFront);

      const back = new THREE.Mesh(backGeo, backMat);
      back.position.set(0, 0, -PHONE_D / 2 - BEVEL - 0.1);
      back.rotation.y = Math.PI;
      mockup.add(back);

      const island = new THREE.Mesh(islandGeo, titaniumMat);
      island.position.set(-PHONE_W / 2 + 54, PHONE_H / 2 - 58, -PHONE_D / 2 - BEVEL - 3.2);
      island.rotation.y = Math.PI;
      mockup.add(island);

      lensCoords.forEach(c => {
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(island.position.x + c.dx, island.position.y + c.dy, -PHONE_D / 2 - BEVEL - 5.8);
        const lens = new THREE.Mesh(lensGlassGeo, lensGlassMat);
        lens.position.set(island.position.x + c.dx, island.position.y + c.dy, -PHONE_D / 2 - BEVEL - 7.9);
        lens.rotation.y = Math.PI;
        mockup.add(ring, lens);
      });

      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.position.set(island.position.x + 23, island.position.y + 24, -PHONE_D / 2 - BEVEL - 5.2);
      flash.rotation.y = Math.PI;
      const lidar = new THREE.Mesh(lidarGeo, lidarMat);
      lidar.position.set(island.position.x + 23, island.position.y - 24, -PHONE_D / 2 - BEVEL - 5.2);
      lidar.rotation.y = Math.PI;
      mockup.add(flash, lidar);

      const powerBtn = new THREE.Mesh(powerBtnGeo, btnMat);
      powerBtn.position.set(PHONE_W / 2 + BEVEL + 1.2, 40, 0);
      const volUpBtn = new THREE.Mesh(volUpGeo, btnMat);
      volUpBtn.position.set(-PHONE_W / 2 - BEVEL - 1.2, 50, 0);
      const volDownBtn = new THREE.Mesh(volDownGeo, btnMat);
      volDownBtn.position.set(-PHONE_W / 2 - BEVEL - 1.2, 8, 0);
      const actionBtn = new THREE.Mesh(actionBtnGeo, btnMat);
      actionBtn.position.set(-PHONE_W / 2 - BEVEL - 1.2, 92, 0);
      const usbc = new THREE.Mesh(usbcGeo, usbcMat);
      usbc.position.set(0, -PHONE_H / 2 - BEVEL - 0.5, 0);
      mockup.add(powerBtn, volUpBtn, volDownBtn, actionBtn, usbc);

      mockup.userData = {
        index: i,
        site: site,
        url: site.link || site.href,
        title: site.title,
        isClickable: true,
        baseScale: 1.0,
        targetPos: { x: 0, y: 10, z: 330 },
        onHoverStart: () => {
          gsap.to(mockup.scale, {
            x: (mockup.userData.baseScale || 1.0) * 1.04,
            y: (mockup.userData.baseScale || 1.0) * 1.04,
            z: (mockup.userData.baseScale || 1.0) * 1.04,
            duration: 0.25,
            ease: 'power2.out'
          });
        },
        onHoverEnd: () => {
          const bs = mockup.userData.baseScale || 1.0;
          gsap.to(mockup.scale, { x: bs, y: bs, z: bs, duration: 0.25, ease: 'power2.out' });
        }
      };

      this.mockups.push(mockup);
      this.clickableObjects.push(mockup);
      this.carouselRingGroup.add(mockup);
    });

    this.phone = this.mockups[0];
    this.phonesList = this.mockups;
    this.phoneHero = this.mockups[0];
    this.phoneMaterials = this.mockupMaterials;
    this.phoneFrontGlassMat = frontGlassMat;
    // Materiais que vão a opacidade 1 (o vidro frontal fica em 0.08)
    this.phoneOpaqueMaterials = this.mockupMaterials.filter(m => m !== frontGlassMat);

    this.carouselRingGroup.position.set(0, 10, -40);
    this.carouselRingGroup.rotation.set(0.08, 0, 0);
    this.chapter01Group.add(this.carouselRingGroup);

    this.updateMockupCarouselPositions(0);
  }

  updateMockupCarouselPositions(angle) {
    this.carouselAngle = angle;
    if (!this.mockups || !this.mockups.length) return;
    const NUM = this.mockups.length;
    const RADIUS_X = 410;
    const RADIUS_Z = 330;
    const step = (Math.PI * 2) / NUM;

    this.mockups.forEach((mockup, i) => {
      const theta = angle + i * step;
      const rawX = RADIUS_X * Math.sin(theta);
      const rawZ = RADIUS_Z * Math.cos(theta);
      const x = Math.abs(rawX) < 0.001 ? 0 : rawX;
      const z = Math.abs(rawZ) < 0.001 ? 0 : rawZ; // z > 0: frente; z < 0: fundo/trás
      const y = Math.sin(theta * 2 + 0.4) * 6;

      mockup.position.set(x, y, z);

      const frontFactor = (z / RADIUS_Z + 1) * 0.5;

      const facingAngle = -theta;
      const rotY = facingAngle * 0.42;
      const rotX = 0.03 + (1.0 - frontFactor) * 0.06;
      const rotZ = Math.sin(theta) * -0.035;

      mockup.rotation.set(rotX, rotY, rotZ);

      // Escala com profundidade: 1.05 na frente, 0.72 no fundo
      const scale = THREE.MathUtils.lerp(0.72, 1.05, frontFactor);
      mockup.scale.setScalar(scale);
      mockup.userData.baseScale = scale;

      mockup.renderOrder = Math.round(frontFactor * 50);

      if (mockup.userData.targetPos) {
        mockup.userData.targetPos.x = x;
        mockup.userData.targetPos.y = y;
        mockup.userData.targetPos.z = z;
      }
    });

    let bestZ = -Infinity;
    let frontIdx = 0;
    this.mockups.forEach((m, idx) => {
      if (m.position.z > bestZ) {
        bestZ = m.position.z;
        frontIdx = idx;
      }
    });

    if (frontIdx !== this.activeSiteIndex) {
      this.activeSiteIndex = frontIdx;
      // Assinatura: (site, índice, total) — cada celular guarda o próprio link em userData
      this.onSiteChange?.(sitesData[frontIdx], frontIdx, NUM);
    }
  }

  showSite(direction) {
    if (this.siteTransition?.isActive()) return Promise.resolve(false);
    const step = (Math.PI * 2) / sitesData.length;
    const targetAngle = this.carouselState.angle - direction * step;
    const nextIdx = (this.activeSiteIndex + direction + sitesData.length) % sitesData.length;

    return new Promise(resolve => {
      this.siteTransition = gsap.to(this.carouselState, {
        angle: targetAngle,
        duration: this.reducedMotion.matches ? 0 : 0.72,
        ease: 'power2.out',
        onUpdate: () => {
          this.updateMockupCarouselPositions(this.carouselState.angle);
        },
        onComplete: () => {
          this.activeSiteIndex = nextIdx;
          this.updateMockupCarouselPositions(targetAngle);
          this.onSiteChange?.(sitesData[nextIdx], nextIdx, sitesData.length);
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
     ATO 02: ESCADA EM ESPIRAL 3D DOS CARROSSÉIS (HELIX 3D)
     Unidades da cena: câmera em z=1100 (≈1 unidade = 1px no plano z=0)
     ========================================================================== */
  buildChapter02() {
    this.spiralCarouselGroup = new THREE.Group();
    this.chapter02Group.add(this.spiralCarouselGroup);

    this.spiralSlides = [];
    this.spiralMaterials = [];

    // Proporção 4:5 de carrossel do Instagram
    const SLIDE_W = 222;
    const SLIDE_H = 277.5;
    const slideGeo = new THREE.PlaneGeometry(SLIDE_W, SLIDE_H);
    const frameGeo = new THREE.BoxGeometry(SLIDE_W + 12, SLIDE_H + 12, 5);
    const borderGeo = new THREE.EdgesGeometry(frameGeo);

    // Parâmetros da hélice (escada em espiral)
    const { radius, pitch, angleStep } = SPIRAL;

    const edgeColorFor = (category) => {
      if (category === 'Loja AURA') return 0x2563eb;
      if (category === 'Vanessa Chaves') return 0x991b1b;
      return 0x64748b;
    };

    spiralSlidesData.forEach((item, index) => {
      const slideGroup = new THREE.Group();

      // Chassi escuro de cada lâmina
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x0b0f1a,
        roughness: 0.6,
        metalness: 0.3,
        transparent: true,
        opacity: 0
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.z = -3.5;
      slideGroup.add(frameMesh);

      // Borda sutil cobalto / vinho / prata por coleção
      const edgeMat = new THREE.LineBasicMaterial({
        color: edgeColorFor(item.category),
        transparent: true,
        opacity: 0
      });
      const edgeLines = new THREE.LineSegments(borderGeo, edgeMat);
      edgeLines.position.z = -3.5;
      slideGroup.add(edgeLines);

      // Lâmina: placeholder escuro até a textura .webp chegar (ver loadSpiralTextures)
      const slideMat = new THREE.MeshBasicMaterial({
        color: 0x111522,
        transparent: true,
        opacity: 0,
        toneMapped: false
      });
      const slideMesh = new THREE.Mesh(slideGeo, slideMat);
      slideMesh.position.z = 0.5;
      slideGroup.add(slideMesh);

      this.spiralMaterials.push(frameMat, edgeMat, slideMat);

      // Degrau i: ângulo θ = i·passo, descendo `pitch` a cada lâmina
      const theta = index * angleStep;
      slideGroup.position.set(Math.sin(theta) * radius, -index * pitch, Math.cos(theta) * radius);
      // Normal da lâmina aponta para fora do eixo (fica de frente quando chega em θ=0)
      slideGroup.rotation.set(-0.07, theta, 0.035);

      slideGroup.userData = { index, item, slideMat, isSpiralSlide: true };

      this.spiralCarouselGroup.add(slideGroup);
      this.spiralSlides.push(slideGroup);
    });

    this.spiralCarouselGroup.position.set(0, -330, SPIRAL.depth - 270);
  }

  // Baixa as 20 lâminas só depois da entrada no site, sem pesar a tela preta inicial.
  // Cada textura sobe para a GPU assim que chega, evitando um engasgo ao entrar no Ato 02.
  loadSpiralTextures() {
    if (this.spiralTexturesRequested || !this.spiralSlides) return;
    this.spiralTexturesRequested = true;
    const loader = new THREE.TextureLoader();
    this.spiralSlides.forEach((slideGroup) => {
      const { slideMat, item } = slideGroup.userData;
      loader.load(item.src, (tex) => {
        if (this._disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.maxAniso;
        slideMat.map = tex;
        slideMat.color.set(0xffffff);
        slideMat.needsUpdate = true;
        this.renderer.initTexture?.(tex);
      });
    });
  }

  /* ==========================================================================
     ATO 03: "ADAPTÁVEL. DO SEU JEITO." & MOCKUPS DE BROWSER FLUTUANDO
     ========================================================================== */
  buildChapter03() {
    this.contactGroup = new THREE.Group();
    this.chapter03Group.add(this.contactGroup);

    this.contactMaterials = [];
    this.browserMockups = [];
    this.contactTextures = [];

    // 1. Tipografia cenográfica
    const titleCanvas = document.createElement('canvas');
    titleCanvas.width = 2048;
    titleCanvas.height = 512;
    const titleTex = new THREE.CanvasTexture(titleCanvas);
    titleTex.colorSpace = THREE.SRGBColorSpace;
    titleTex.anisotropy = this.maxAniso;

    const drawTitle = () => {
      const tCtx = titleCanvas.getContext('2d');
      tCtx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
      tCtx.textAlign = 'center';
      tCtx.textBaseline = 'middle';

      tCtx.font = '700 34px "Space Mono", monospace';
      tCtx.fillStyle = '#60a5fa';
      if ('letterSpacing' in tCtx) tCtx.letterSpacing = '6px';
      tCtx.fillText('SOCIAL MEDIA DESIGNER  ·  WEB DEVELOPER  ·  AI PRODUCT BUILDER', 1024, 140);

      if ('letterSpacing' in tCtx) tCtx.letterSpacing = '0px';
      tCtx.shadowColor = 'rgba(37, 99, 235, 0.45)';
      tCtx.shadowBlur = 32;
      tCtx.font = '800 132px "Inter", sans-serif';
      tCtx.fillStyle = '#f8fafc';
      tCtx.fillText('ADAPTÁVEL. DO SEU JEITO.', 1024, 300);
      tCtx.shadowBlur = 0;
      titleTex.needsUpdate = true;
    };

    const titleMat = new THREE.MeshBasicMaterial({
      map: titleTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(1080, 270), titleMat);
    titleMesh.position.set(0, 300, -60);
    this.contactGroup.add(titleMesh);
    this.contactMaterials.push(titleMat);
    this.contactTextures.push(titleTex);

    // 2. Quatro mockups de browser com links de contato
    const contacts = [
      {
        id: 'whatsapp', label: 'WHATSAPP', badge: 'ONLINE AGORA',
        domain: 'wa.me/5521982566564',
        headline: 'Vamos conversar?', sub: 'Orçamentos, freelas & projetos rápidos',
        cta: 'INICIAR CONVERSA ↗', accent: '#22c55e',
        url: 'https://wa.me/5521982566564',
        pos: [-472, -52, 52], rot: [0.04, 0.26, 0.02]
      },
      {
        id: 'linkedin', label: 'LINKEDIN', badge: 'NETWORK',
        domain: 'linkedin.com/in/camillapaschoal',
        headline: 'Camilla Paschoal', sub: 'Trajetória, conexões & experiências',
        cta: 'CONECTAR NO LINKEDIN ↗', accent: '#3b82f6',
        url: 'https://www.linkedin.com/in/camillapaschoal/',
        pos: [-158, -82, 112], rot: [0.03, 0.09, 0.01]
      },
      {
        id: 'github', label: 'GITHUB', badge: 'REPOSITÓRIOS',
        domain: 'github.com/ccpaschoal',
        headline: '@ccpaschoal', sub: 'Código, WebGL, React & experimentos IA',
        cta: 'EXPLORAR CÓDIGO ↗', accent: '#a855f7',
        url: 'https://github.com/ccpaschoal',
        pos: [158, -82, 112], rot: [0.03, -0.09, -0.01]
      },
      {
        id: 'email', label: 'E-MAIL DIRETO', badge: 'CONTATO FORMAL',
        domain: 'camillacpaschoal@gmail.com', scheme: 'mailto:',
        headline: 'Proposta & Briefing', sub: 'camillacpaschoal@gmail.com',
        cta: 'ENVIAR E-MAIL ↗', accent: '#e11d48',
        url: 'mailto:camillacpaschoal@gmail.com',
        pos: [472, -52, 52], rot: [0.04, -0.26, -0.02]
      }
    ];

    const BROWSER_W = 288;
    const BROWSER_H = 198;
    const screenGeo = new THREE.PlaneGeometry(BROWSER_W, BROWSER_H);
    const chassisGeo = new THREE.BoxGeometry(BROWSER_W + 12, BROWSER_H + 12, 7.5);
    const chassisEdgesGeo = new THREE.EdgesGeometry(chassisGeo);
    const browserCanvases = [];

    const drawBrowser = (ctx, item) => {
      const W = 1024;
      const H = 704;
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Fundo dark glass
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#0b1120');
      grad.addColorStop(1, '#16070c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Barra superior do browser
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, W, 88);

      // Bolinhas da janela
      ['#ef4444', '#f59e0b', '#10b981'].forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(46 + i * 28, 44, 9, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      });

      // Barra de URL
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(150, 20, 830, 48, 12);
      ctx.fill();
      ctx.font = '400 22px "Space Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${item.scheme || 'https://'}${item.domain}`, 178, 51);

      // Badge de status
      ctx.fillStyle = item.accent;
      ctx.beginPath();
      ctx.roundRect(64, 138, 280, 44, 22);
      ctx.fill();
      ctx.font = '700 20px "Inter", sans-serif';
      ctx.fillStyle = '#080c16';
      ctx.fillText(item.badge, 88, 167);

      // Título e subtítulo
      ctx.font = '800 64px "Inter", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(item.headline, 64, 300);
      ctx.font = '400 32px "Inter", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(item.sub, 64, 366);

      // Botão CTA
      ctx.beginPath();
      ctx.roundRect(64, 520, 500, 84, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = item.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = '700 28px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.cta, 100, 572);
    };

    contacts.forEach((item) => {
      const browserGroup = new THREE.Group();

      const bCanvas = document.createElement('canvas');
      bCanvas.width = 1024;
      bCanvas.height = 704;
      const ctx = bCanvas.getContext('2d');

      const screenTex = new THREE.CanvasTexture(bCanvas);
      screenTex.colorSpace = THREE.SRGBColorSpace;
      screenTex.generateMipmaps = true;
      screenTex.minFilter = THREE.LinearMipmapLinearFilter;
      screenTex.anisotropy = this.maxAniso;
      browserCanvases.push({ ctx, item, tex: screenTex });
      this.contactTextures.push(screenTex);

      const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.25,
        metalness: 0.75,
        transparent: true,
        opacity: 0
      });
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      chassisMesh.position.z = -4.5;
      browserGroup.add(chassisMesh);

      const borderMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(item.accent),
        transparent: true,
        opacity: 0
      });
      const borderLines = new THREE.LineSegments(chassisEdgesGeo, borderMat);
      borderLines.position.z = -4.5;
      browserGroup.add(borderLines);

      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTex,
        transparent: true,
        opacity: 0,
        toneMapped: false
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.z = 0.5;
      browserGroup.add(screenMesh);

      this.contactMaterials.push(chassisMat, borderMat, screenMat);

      // O slot recebe a posição do layout (arco no desktop, grade 2×2 em tela em pé);
      // a timeline anima só o browser dentro dele (y: -210 -> 0)
      const slot = new THREE.Group();
      slot.userData.layout = { arc: { pos: item.pos, rot: item.rot } };
      slot.add(browserGroup);

      browserGroup.userData = {
        id: item.id,
        url: item.url,
        title: item.label,
        isClickable: true,
        isContactBrowser: true,
        baseY: 0,
        baseZ: 0,
        onHoverStart: () => {
          gsap.to(browserGroup.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.25, ease: 'power2.out' });
          gsap.to(borderMat.color, { r: 1, g: 1, b: 1, duration: 0.25 });
        },
        onHoverEnd: () => {
          const c = new THREE.Color(item.accent);
          gsap.to(browserGroup.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'power2.out' });
          gsap.to(borderMat.color, { r: c.r, g: c.g, b: c.b, duration: 0.25 });
        }
      };

      this.clickableObjects.push(browserGroup);
      this.contactGroup.add(slot);
      this.browserMockups.push(browserGroup);
    });
    this.contactTitleMesh = titleMesh;

    const redrawAll = () => {
      drawTitle();
      browserCanvases.forEach(({ ctx, item, tex }) => {
        drawBrowser(ctx, item);
        tex.needsUpdate = true;
      });
    };
    redrawAll();
    // Redesenha quando as webfonts terminarem de carregar (evita fonte fallback no canvas)
    canvasFontsReady().then(() => {
      if (!this._disposed) redrawAll();
    });

    this.contactGroup.position.set(0, -390, -225);
  }

  /* ==========================================================================
     MASTER TIMELINE GSAP NARRATIVA (0s -> 100s / PROGRESSO 0.0 A 1.0)
     00: Polaroids | 01: Celulares | 02: Espiral | 03: Browsers de contato
     Platôs de snap: 0.00 · 0.35 · 0.60 · 0.90
     ========================================================================== */
  initMasterTimeline() {
    if (this.masterTimeline) this.masterTimeline.kill();

    this.masterTimeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        if (document.body.classList.contains('is-teaser')) return;
        const t = this.masterTimeline.time();
        const overlap = !this.reducedMotion.matches;
        this.chapter00Group.visible = t < (overlap ? 27.5 : 25);
        this.chapter01Group.visible = t >= (overlap ? 21 : 25) && t < 48.5;
        this.chapter02Group.visible = t >= (overlap ? 43.5 : 50) && t < 77;
        this.chapter03Group.visible = t >= (overlap ? 71 : 75);

        // Depois de subir nas Polaroids a poeira fica desligada pelo resto do site
        if (this.dustParticles && !this.teaserTimeline?.isActive()) {
          this.dustParticles.visible = false;
        }
        if (!this.spiralTexturesRequested && t > 20) this.loadSpiralTextures();
      }
    });

    // Âncora de 100s exatos para mapear progress 0.00 -> 1.00
    this.masterTimeline.set({}, {}, 100);

    /* --- ATO 00: POLAROIDS (0s -> 27s) --- */
    this.masterTimeline.to(this.chapter00Group.position, { z: -420, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.leftPolaroid.position, { y: 1150, x: -390, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.rightPolaroid.position, { y: 1150, x: 390, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.centerPolaroid.position, { y: 1200, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.leftPolaroid.rotation, { z: -0.16, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.rightPolaroid.rotation, { z: 0.16, duration: 21, ease: 'power1.in', immediateRender: false }, 3);
    this.masterTimeline.to(this.polaroidMaterials, { opacity: 0, duration: 6.0, ease: 'power1.inOut', immediateRender: false }, 20.5);

    /* --- ATO 01: 4 SMARTPHONES EM CARROSSEL CIRCULAR (21s -> 48s) ---
       Platô estável de 28s a 42s (snap em 0.35: a rodinha folheia os sites) */
    this.masterTimeline.fromTo(this.phoneRimLight, { intensity: 0 }, { intensity: 1.4, duration: 4, immediateRender: false }, 22);
    this.masterTimeline.fromTo(this.carouselRingGroup.position,
      { x: 0, y: -40, z: -850 },
      { x: 0, y: 10, z: -40, duration: 6, ease: 'power2.out', immediateRender: false }, 22);
    this.masterTimeline.fromTo(this.carouselRingGroup.scale,
      { x: 0.1, y: 0.1, z: 0.1 },
      { x: 1, y: 1, z: 1, duration: 6, ease: 'power2.out', immediateRender: false }, 22);
    this.masterTimeline.fromTo(this.carouselRingGroup.rotation,
      { x: 0.25, y: -0.35, z: 0.05 },
      { x: 0.08, y: 0, z: 0, duration: 6, ease: 'power2.out', immediateRender: false }, 22);
    this.masterTimeline.fromTo(this.phoneOpaqueMaterials,
      { opacity: 0 },
      { opacity: 1, duration: 4.5, ease: 'power2.out', immediateRender: false }, 22);
    this.masterTimeline.fromTo(this.phoneFrontGlassMat,
      { opacity: 0 },
      { opacity: 0.08, duration: 4.5, ease: 'power2.out', immediateRender: false }, 22);

    // Saída: recua para o fundo abrindo espaço para a espiral (42s -> 47s)
    this.masterTimeline.to(this.carouselRingGroup.position,
      { x: 0, y: 280, z: -700, duration: 5, ease: 'power2.in', immediateRender: false }, 42);
    this.masterTimeline.to(this.carouselRingGroup.scale,
      { x: 0.4, y: 0.4, z: 0.4, duration: 5, ease: 'power2.in', immediateRender: false }, 42);
    this.masterTimeline.to(this.phoneOpaqueMaterials,
      { opacity: 0, duration: 4, ease: 'power2.in', immediateRender: false }, 43);
    this.masterTimeline.to(this.phoneFrontGlassMat,
      { opacity: 0, duration: 4, ease: 'power2.in', immediateRender: false }, 43);
    this.masterTimeline.to(this.phoneRimLight, { intensity: 0, duration: 3, immediateRender: false }, 44);

    /* --- ATO 02: ESPIRAL 3D DOS CARROSSÉIS (44s -> 76s) ---
       Descida contínua pela escada (49s -> 71s), subida final sumindo para cima */
    const totalSlides = spiralSlidesData.length;
    const totalClimbY = (totalSlides - 1) * SPIRAL.pitch;
    const totalTwistY = -(totalSlides - 1) * SPIRAL.angleStep;

    this.masterTimeline.fromTo(this.spiralRimLight, { intensity: 0 }, { intensity: 3.2, duration: 4, immediateRender: false }, 44);
    this.masterTimeline.fromTo(this.spiralCarouselGroup.position,
      { y: -330, z: SPIRAL.depth - 270 },
      { y: 0, z: SPIRAL.depth, duration: 5, ease: 'power2.out', immediateRender: false }, 44);
    this.masterTimeline.fromTo(this.spiralMaterials,
      { opacity: 0 },
      { opacity: 1, duration: 4.5, ease: 'power2.out', immediateRender: false }, 44);

    this.masterTimeline.fromTo(this.spiralCarouselGroup.position,
      { y: 0 },
      { y: totalClimbY, duration: 22, ease: 'none', immediateRender: false }, 49);
    this.masterTimeline.fromTo(this.spiralCarouselGroup.rotation,
      { y: 0 },
      { y: totalTwistY, duration: 22, ease: 'none', immediateRender: false }, 49);

    this.masterTimeline.fromTo(this.spiralCarouselGroup.position,
      { y: totalClimbY, z: SPIRAL.depth },
      { y: totalClimbY + 900, z: SPIRAL.depth - 240, duration: 5, ease: 'power2.in', immediateRender: false }, 71);
    this.masterTimeline.fromTo(this.spiralCarouselGroup.scale,
      { x: 1, y: 1, z: 1 },
      { x: 0.84, y: 0.84, z: 0.84, duration: 5, ease: 'power2.in', immediateRender: false }, 71);
    this.masterTimeline.to(this.spiralMaterials,
      { opacity: 0, duration: 4.5, ease: 'power2.in', immediateRender: false }, 71.5);
    this.masterTimeline.to(this.spiralRimLight, { intensity: 0, duration: 3, immediateRender: false }, 72);

    /* --- ATO 03: CONTATO (72s -> 100s) — platô final estável a partir de 82s --- */
    this.masterTimeline.fromTo(this.contactGroup.position,
      { y: -390, z: -225 },
      { y: 0, z: 0, duration: 9, ease: 'power3.out', immediateRender: false }, 72);
    this.browserMockups.forEach((browser, idx) => {
      const targetY = browser.userData.baseY;
      this.masterTimeline.fromTo(browser.position,
        { y: targetY - 210 },
        { y: targetY, duration: 7, ease: 'back.out(1.4)', immediateRender: false },
        73.5 + idx * 0.8);
    });
    this.masterTimeline.fromTo(this.contactMaterials,
      { opacity: 0 },
      { opacity: 1, duration: 7, ease: 'power2.out', immediateRender: false }, 72.5);
  }

  /* ==========================================================================
     TRANSIÇÃO DO TEASER: SUBIDA DO MAÇO, ABERTURA EM LEQUE E POEIRA SUBINDO
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

    if (this.teaserTimeline) this.teaserTimeline.kill();
    this.teaserTimeline = gsap.timeline({
      onComplete: () => {
        this.currentChapter = 0;
        this.isTransitioning = false;
        if (this.masterTimeline) {
          this.masterTimeline.pause();
          this.masterTimeline.progress(0);
        }
        this.loadSpiralTextures();
      }
    });

    const tl = this.teaserTimeline;

    // Subida suave e contínua surgindo da esquerda para a direita (stagger orgânico)
    tl.to(this.leftPolaroid.position, { y: -12, z: -15, duration: 1.15, ease: 'power2.out' }, 0);
    tl.to(this.centerPolaroid.position, { y: 12, z: 35, duration: 1.15, ease: 'power2.out' }, 0.08);
    tl.to(this.rightPolaroid.position, { y: -12, z: -15, duration: 1.15, ease: 'power2.out' }, 0.16);

    // Desdobramento em leque
    tl.to(this.leftPolaroid.position, { x: -395, duration: 0.90, ease: 'power2.out' }, 0.20);
    tl.to(this.leftPolaroid.rotation, { z: -0.09, y: 0.12, duration: 0.90, ease: 'power2.out' }, 0.20);
    tl.to(this.centerPolaroid.rotation, { z: 0.005, y: 0.0, duration: 0.90, ease: 'power2.out' }, 0.28);
    tl.to(this.rightPolaroid.position, { x: 395, duration: 0.90, ease: 'power2.out' }, 0.36);
    tl.to(this.rightPolaroid.rotation, { z: 0.09, y: -0.12, duration: 0.90, ease: 'power2.out' }, 0.36);

    // Poeira: o vento a sopra para cima sobre as Polaroids, ela some e é desligada
    if (this.dustParticles && this.dustMaterial) {
      const uniforms = this.dustMaterial.uniforms;
      this.dustParticles.visible = true;
      // uWind 1.2 zera a vida de todas as partículas no shader (vida = 1 - uWind·[0.85..1.30])
      // Mesma duração do leque (~1.3s) para não segurar a rolagem
      tl.fromTo(uniforms.uWind, { value: 0.0 }, { value: 1.2, duration: 1.3, ease: 'power2.in' }, 0);
      tl.to(uniforms.uOpacity, { value: 0.0, duration: 1.05, ease: 'power2.out' }, 0.2);
      tl.call(() => {
        if (this.dustParticles) this.dustParticles.visible = false;
      }, null, 1.3);
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
    if (this.dustParticles) this.dustParticles.visible = true;
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
    const portrait = aspect < 0.8;

    // Celulares: o aparelho da frente (≈218 de largura) ocupa no máx. ~55% da tela;
    // em tela estreita os laterais saem pelas bordas, como no carrossel original
    if (this.chapter01Group) this.chapter01Group.scale.setScalar(Math.min(1, (visibleWidth * 0.55) / 218));

    // Hélice: ≈1160 de largura total; em pé prioriza a lâmina da frente legível
    if (this.chapter02Group) {
      this.chapter02Group.scale.setScalar(Math.min(1, (visibleWidth * (portrait ? 0.9 : 0.95)) / (portrait ? 620 : 1160)));
    }

    // Contato: arco de 4 browsers (≈1280) no desktop, grade 2×2 (≈620) em tela em pé
    if (this.chapter03Group) {
      this.chapter03Group.scale.setScalar(Math.min(1, (visibleWidth * 0.92) / (portrait ? 620 : 1280)));
      const grid = [[-155, 20], [155, 20], [-155, -200], [155, -200]];
      this.contactGroup?.children.forEach((slot) => {
        const arc = slot.userData.layout?.arc;
        if (!arc) return;
        const i = this.contactGroup.children.filter(c => c.userData.layout).indexOf(slot);
        if (portrait) {
          slot.position.set(grid[i][0], grid[i][1], 40);
          slot.rotation.set(0.03, grid[i][0] < 0 ? 0.06 : -0.06, 0);
        } else {
          slot.position.set(...arc.pos);
          slot.rotation.set(...arc.rot);
        }
      });
      if (this.contactTitleMesh) {
        this.contactTitleMesh.scale.setScalar(portrait ? 0.58 : 1);
        this.contactTitleMesh.position.y = portrait ? 220 : 300;
      }
    }
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

    // Mouse parallax 3D tátil por ato (01 celulares, 02 espiral, 03 browsers)
    if (!this.reducedMotion.matches) {
      const mx = this.mouseNormX || 0;
      const my = this.mouseNormY || 0;
      for (let i = 0; i < this.parallaxGroups.length; i++) {
        const entry = this.parallaxGroups[i];
        const group = entry[0];
        if (!group.visible) continue;
        group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, mx * entry[1], 0.06);
        group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -my * entry[2], 0.06);
      }
    }

    // Hélice: só a metade voltada para a câmera fica visível (sem costas cinza das lâminas)
    if (this.spiralSlides && this.chapter02Group?.visible) {
      const twist = this.spiralCarouselGroup.rotation.y;
      for (let i = 0; i < this.spiralSlides.length; i++) {
        this.spiralSlides[i].visible = Math.cos(i * SPIRAL.angleStep + twist) > -0.3;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._disposed = true;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.masterTimeline) this.masterTimeline.kill();
    if (this.teaserTimeline) this.teaserTimeline.kill();
    if (this.siteTransition) this.siteTransition.kill();
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
    if (this.contactTextures) this.contactTextures.forEach(t => t.dispose());
    if (this.siteScreenTextures) this.siteScreenTextures.forEach(t => t.dispose());
    if (this.envRenderTarget) this.envRenderTarget.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
