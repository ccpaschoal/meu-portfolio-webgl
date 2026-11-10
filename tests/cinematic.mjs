import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

console.log('--- INICIANDO TESTES DO PORTFÓLIO WEBGL (NARRATIVA CONTÍNUA E MASTER TIMELINE) ---');

// 1. Inicia o servidor Vite em porta efêmera
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false, strictPort: false }
});
await server.listen();
const port = server.httpServer.address().port;
const baseURL = `http://127.0.0.1:${port}`;

// 2. Inicia o navegador (Edge prioritário no ambiente Windows da Camilla)
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.portfolioApp && window.portfolioApp.renderer);

  // TESTE 1: Renderizador WebGL Único e Eliminação de Cinema
  console.log('-> Testando WebGLRenderer e eliminação total de cinema...');
  const webglStatus = await page.evaluate(() => {
    const app = window.portfolioApp;
    const gl = app.renderer.getContext();
    const canvas = document.querySelector('#webgl-container canvas');
    return {
      hasCanvas: !!canvas,
      isWebGL: !!gl,
      toneMapping: app.renderer.toneMapping,
      toneMappingExposure: app.renderer.toneMappingExposure,
      noCone: !app.beamMesh && !app.projectorSpot,
      noCinemaScreen: !app.screenMesh,
      noDOMIn3D: document.querySelectorAll('.film-ring-frame, .site-projector').length === 0
    };
  });

  assert.ok(webglStatus.hasCanvas, 'Canvas WebGL deve existir dentro de #webgl-container');
  assert.ok(webglStatus.isWebGL, 'Contexto WebGL deve estar ativo');
  assert.equal(webglStatus.toneMapping, 4, 'ToneMapping deve ser ACESFilmicToneMapping');
  assert.equal(webglStatus.toneMappingExposure, 1.05, 'Exposição deve ser 1.05');
  assert.ok(webglStatus.noCone, 'Cones volumétricos e projetores de cinema foram completamente removidos');
  assert.ok(webglStatus.noCinemaScreen, 'Telas cinzas de projeção foram completamente removidas');
  assert.ok(webglStatus.noDOMIn3D, 'Nenhum nó DOM no espaço 3D');

  // TESTE 2: Sistema Dual-Tone de Poeira (6.500 partículas)
  console.log('-> Testando poeira 3D (6.500 partículas em buffer único)...');
  const dustStatus = await page.evaluate(() => {
    const app = window.portfolioApp;
    const pts = app.dustParticles;
    if (!pts) return null;
    const geo = pts.geometry;
    return {
      count: geo.attributes.position.count,
      hasColorType: !!geo.attributes.aColorType,
      hasScale: !!geo.attributes.aScale,
      radius: pts.material.uniforms.uRadius.value
    };
  });

  assert.ok(dustStatus, 'Sistema de partículas de poeira deve existir');
  assert.equal(dustStatus.count, 6500, 'Devem existir exatamente 6.500 partículas');
  assert.ok(dustStatus.hasColorType, 'Partículas devem ter atributo aColorType');
  assert.ok(dustStatus.hasScale, 'Partículas devem ter atributo aScale');
  assert.equal(dustStatus.radius, 75.0, 'Raio de influência deve ser compacto (75px)');

  // TESTE 3: Estado Inicial do Prólogo (Teaser)
  console.log('-> Testando Estado Inicial do Prólogo / Teaser...');
  const teaserInitial = await page.evaluate(() => {
    const app = window.portfolioApp;
    const teaserEl = document.getElementById('intro-teaser');
    const trackerEl = document.getElementById('chapter-tracker');
    const isTeaser = document.body.classList.contains('is-teaser');
    const trackerStyle = window.getComputedStyle(trackerEl);

    return {
      isTeaser,
      hasTeaserEl: !!teaserEl,
      chapter00Visible: app.chapter00Group.visible,
      trackerHidden: trackerStyle.visibility === 'hidden' || trackerStyle.opacity === '0'
    };
  });

  assert.ok(teaserInitial.isTeaser, 'Body deve ter classe is-teaser inicialmente');
  assert.ok(teaserInitial.hasTeaserEl, '#intro-teaser deve existir no DOM');
  assert.equal(teaserInitial.chapter00Visible, false, 'Capítulo 00 deve nascer invisível');
  assert.ok(teaserInitial.trackerHidden, 'Tracker lateral deve nascer invisível');

  // TESTE 4: Disparo do Teaser e Abertura em Leque do Tríptico
  console.log('-> Testando Disparo do Teaser e abertura em leque...');
  await page.locator('#intro-teaser').click();
  await page.waitForTimeout(1400);

  const teaserTriggered = await page.evaluate(() => {
    const app = window.portfolioApp;
    const isTeaser = document.body.classList.contains('is-teaser');
    return {
      isTeaser,
      currentChapter: app.currentChapter,
      chapter00Visible: app.chapter00Group.visible,
      leftX: app.leftPolaroid.position.x,
      centerX: app.centerPolaroid.position.x,
      rightX: app.rightPolaroid.position.x
    };
  });

  assert.equal(teaserTriggered.isTeaser, false, 'Body não deve mais ter is-teaser');
  assert.equal(teaserTriggered.currentChapter, 0, 'currentChapter deve ser 0 (Matriz)');
  assert.ok(teaserTriggered.chapter00Visible, 'Capítulo 00 deve se tornar visível');
  assert.ok(teaserTriggered.leftX < -200, 'Polaroid esquerda deve ter aberto para a esquerda');
  assert.ok(teaserTriggered.rightX > 200, 'Polaroid direita deve ter aberto para a direita');

  // TESTE 5: Master Timeline (Controle Contínuo dos 4 Atos)
  console.log('-> Testando Master Timeline contínua (0.0 a 1.0)...');
  const acts = await page.evaluate(() => {
    const app = window.portfolioApp;
    const sample = (p) => {
      app.masterTimeline.progress(p);
      return [app.chapter00Group, app.chapter01Group, app.chapter02Group, app.chapter03Group]
        .map(g => g.visible);
    };
    return {
      duration: app.masterTimeline.duration(),
      p035: sample(0.35),
      p060: sample(0.60),
      p090: sample(0.90),
      dustVisible: app.dustParticles.visible
    };
  });
  assert.equal(acts.duration, 100, 'Master timeline deve ter exatamente 100s');
  assert.deepEqual(acts.p035, [false, true, false, false], 'Ato 01 (celulares) sozinho em 0.35');
  assert.deepEqual(acts.p060, [false, false, true, false], 'Ato 02 (espiral) sozinho em 0.60');
  assert.deepEqual(acts.p090, [false, false, false, true], 'Ato 03 (contato) sozinho em 0.90');
  assert.equal(acts.dustVisible, false, 'Poeira deve ficar desligada depois do teaser');

  // TESTE 6: Tracker Lateral Editorial (4 Itens e Navegação)
  console.log('-> Testando Tracker Lateral (00 MATRIZ, 01 DIGITAL, 02 ESPIRAL, 03 CONTATO)...');
  const trackerInfo = await page.evaluate(() => {
    const items = document.querySelectorAll('.tracker-list li');
    return { count: items.length, texts: Array.from(items).map(li => li.textContent.trim()) };
  });
  assert.equal(trackerInfo.count, 4, 'Tracker deve conter exatamente 4 atos');
  ['MATRIZ', 'DIGITAL', 'ESPIRAL', 'CONTATO'].forEach((label, i) => {
    assert.ok(trackerInfo.texts[i].includes(label), `Ato ${i} deve ser ${label}`);
  });

  await page.locator('.tracker-list li[data-chapter="1"]').click();
  await page.waitForTimeout(1300);
  const trackerNavResult = await page.evaluate(() => {
    const activeItem = document.querySelector('.tracker-list li.active');
    return {
      activeChapter: activeItem ? parseInt(activeItem.dataset.chapter, 10) : null,
      timelineProgress: window.portfolioApp.masterTimeline.progress()
    };
  });
  assert.equal(trackerNavResult.activeChapter, 1, 'Tracker deve ter ativado o Ato 01');
  assert.ok(trackerNavResult.timelineProgress > 0.15 && trackerNavResult.timelineProgress < 0.45,
    'Timeline deve ter interpolado para o Ato 01');

  await page.locator('.tracker-list li[data-chapter="2"] button').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.portfolioApp.chapter02Group.visible), true,
    'Tracker deve funcionar com Enter pelo teclado');
  assert.equal(await page.locator('.tracker-list li[data-chapter="2"] button').getAttribute('aria-current'), 'step');

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.portfolioApp.chapter03Group.visible), true,
    'Seta para baixo deve avançar para o próximo ato');

  await page.locator('.tracker-list li[data-chapter="1"] button').click();
  await page.locator('.tracker-list li[data-chapter="3"] button').click();
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.portfolioApp.chapter03Group.visible), true,
    'Cliques rápidos no tracker devem terminar no último destino escolhido');

  // TESTE 7: Atualização do Rastro do Cursor na Poeira
  console.log('-> Testando rastro interativo do cursor na poeira...');
  await page.mouse.move(600, 400);
  await page.waitForTimeout(150);
  const mouseUniform = await page.evaluate(() => {
    const u = window.portfolioApp.dustMaterial.uniforms.uMouse.value;
    return { x: u.x, y: u.y };
  });
  assert.ok(Math.abs(mouseUniform.x) < 2000, 'uMouse deve ter sido atualizado com a projeção do cursor');

  // TESTE 8: Celulares, espiral, browsers de contato e raycaster
  console.log('-> Testando celulares, espiral 3D, browsers de contato e raycaster...');
  const engineeringStatus = await page.evaluate(() => {
    const app = window.portfolioApp;
    const clickables = app.clickableObjects;
    return {
      phoneCount: app.phonesList.length,
      centerPhoneX: app.phonesList[0]?.userData?.targetPos?.x,
      spiralCount: app.spiralSlides.length,
      browserCount: app.browserMockups.length,
      browserUrls: app.browserMockups.map(b => b.userData.url),
      clickableCount: clickables.length,
      hasUrls: clickables.every(c => !!c.userData?.url && c.userData?.isClickable)
    };
  });
  assert.equal(engineeringStatus.phoneCount, 4, 'Carrossel 3D deve conter os 4 mockups dos sites');
  assert.ok(Math.abs(engineeringStatus.centerPhoneX) < 0.01, 'Mockup frontal central em X = 0');
  assert.equal(engineeringStatus.spiralCount, 20, 'Espiral deve conter as 20 lâminas dos carrosséis');
  assert.equal(engineeringStatus.browserCount, 4, 'Contato deve ter 4 browsers');
  assert.deepEqual(engineeringStatus.browserUrls, [
    'https://wa.me/5521982566564',
    'https://www.linkedin.com/in/camillapaschoal/',
    'https://github.com/ccpaschoal',
    'mailto:camillacpaschoal@gmail.com'
  ], 'Browsers de contato devem apontar para os links certos');
  assert.equal(engineeringStatus.clickableCount, 8, '4 celulares + 4 browsers clicáveis');
  assert.ok(engineeringStatus.hasUrls, 'Todos os alvos interativos devem possuir URL válida');

  // Transições: cenas visíveis por tempo (com sobreposição suave entre atos)
  for (const [time, expected] of [
    [20, [true, false, false, false]],
    [24, [true, true, false, false]],
    [28, [false, true, false, false]],
    [42, [false, true, false, false]],
    [45, [false, true, true, false]],
    [55, [false, false, true, false]],
    [72, [false, false, true, true]],
    [80, [false, false, false, true]]
  ]) {
    const visible = await page.evaluate((t) => {
      const app = window.portfolioApp;
      app.masterTimeline.time(t);
      return [app.chapter00Group, app.chapter01Group, app.chapter02Group, app.chapter03Group]
        .map(group => group.visible);
    }, time);
    assert.deepEqual(visible, expected, `Cenas visíveis em ${time}s`);
  }

  const transition = await page.evaluate(() => {
    const app = window.portfolioApp;
    const sample = (time) => {
      app.masterTimeline.time(time);
      return {
        opacity: app.leftPolaroid.children[0].material.opacity,
        ringZ: app.carouselRingGroup.position.z,
        ringScale: app.carouselRingGroup.scale.x
      };
    };
    return { before: sample(23), middle: sample(25), after: sample(28), reversed: sample(20) };
  });
  assert.ok(transition.before.ringZ < transition.middle.ringZ && transition.middle.ringZ < transition.after.ringZ,
    'Carrossel de celulares deve se aproximar continuamente da câmera');
  assert.ok(transition.before.ringScale < transition.middle.ringScale && transition.middle.ringScale <= transition.after.ringScale,
    'Carrossel deve ganhar escala sem salto');
  assert.ok(transition.middle.opacity > 0 && transition.middle.opacity < 1,
    'Polaroids devem desaparecer gradualmente');
  assert.equal(transition.reversed.opacity, 1, 'Voltar a rolagem deve restaurar as polaroids');

  // Espiral: desce continuamente e a lâmina da vez fica de frente (θ + giro ≈ 0)
  const spiral = await page.evaluate(() => {
    const app = window.portfolioApp;
    const at = (t) => {
      app.masterTimeline.time(t);
      return { y: app.spiralCarouselGroup.position.y, rotY: app.spiralCarouselGroup.rotation.y };
    };
    const a = at(52); const b = at(60); const c = at(68);
    app.masterTimeline.time(60);
    const front = app.spiralSlides.reduce((best, s) => {
      const z = s.getWorldPosition(app.camera.position.clone()).z;
      return z > best.z ? { z, i: s.userData.index } : best;
    }, { z: -Infinity, i: -1 });
    return { a, b, c, frontIndex: front.i };
  });
  assert.ok(spiral.a.y < spiral.b.y && spiral.b.y < spiral.c.y, 'Espiral deve subir enquanto a narrativa desce');
  assert.ok(spiral.a.rotY > spiral.b.rotY && spiral.b.rotY > spiral.c.rotY, 'Espiral deve girar continuamente');
  assert.ok(spiral.frontIndex >= 8 && spiral.frontIndex <= 11, 'No meio do ato a lâmina da frente deve ser a do meio');

  const siteChange = await page.evaluate(async () => {
    const app = window.portfolioApp;
    const frontUrl = () => app.phonesList[app.activeSiteIndex].userData.url;
    const firstPhoneUrl = app.phonesList[0].userData.url;
    const before = frontUrl();
    await app.showSite(1);
    return {
      before,
      after: frontUrl(),
      index: app.activeSiteIndex,
      firstPhoneKept: app.phonesList[0].userData.url === firstPhoneUrl
    };
  });
  assert.notEqual(siteChange.after, siteChange.before, 'Avançar deve trocar o site mostrado no celular');
  assert.equal(siteChange.index, 1, 'Carrossel deve avançar um item');
  assert.ok(siteChange.firstPhoneKept, 'Cada celular deve manter o próprio link ao girar o carrossel');
  await page.waitForTimeout(100);
  assert.match(await page.locator('#site-caption').textContent(), /^02 \/ 04 · /,
    'Legenda deve mostrar o número e o nome do site da frente');

  const clickAt = (time, pick) => page.evaluate(({ time, pick }) => {
    const app = window.portfolioApp;
    app.masterTimeline.time(time);
    app.scene.updateMatrixWorld(true);
    const target = pick === 'phone'
      ? (app.phonesList[app.activeSiteIndex] || app.phonesList[0])
      : app.browserMockups[2];
    const point = target.getWorldPosition(app.camera.position.clone()).project(app.camera);
    const x = (point.x + 1) * app.width / 2;
    const y = (1 - point.y) * app.height / 2;
    window.__opened = null;
    window.open = (...args) => { window.__opened = args; return null; };
    const clicked = app.handleClick(x, y);
    return { clicked, opened: window.__opened };
  }, { time, pick });

  const phoneClick = await clickAt(35, 'phone');
  assert.equal(phoneClick.clicked, true, 'Mockup frontal deve responder ao clique');
  assert.equal(phoneClick.opened?.[1], '_blank', 'Link deve abrir durante o gesto do clique');
  assert.match(phoneClick.opened?.[2] || '', /noopener/, 'Nova aba não deve acessar a página de origem');
  assert.equal(phoneClick.opened?.[0], siteChange.after, 'Clique no celular deve abrir o site exibido');

  const browserClick = await clickAt(95, 'browser');
  assert.equal(browserClick.clicked, true, 'Browser do GitHub deve responder ao clique');
  assert.equal(browserClick.opened?.[0], 'https://github.com/ccpaschoal', 'Clique deve abrir o GitHub');

  await page.evaluate(() => window.portfolioApp.setProgress(0));
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(700);
  const scrollProgress = await page.evaluate(() => window.portfolioApp.masterTimeline.progress());
  assert.ok(scrollProgress > 0 && scrollProgress < 0.20,
    'Um passo da roda deve avançar a narrativa de forma ágil e suave');

  assert.equal(await page.locator('a[href="https://wa.me/5521982566564"]').count(), 1,
    'WhatsApp deve usar o número informado');

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce'
  });
  try {
    await mobile.goto(baseURL, { waitUntil: 'networkidle' });
    await mobile.waitForFunction(() => !!window.portfolioApp?.renderer);
    await mobile.locator('#intro-teaser').click();
    const mobileStatus = await mobile.evaluate(() => ({
      chapter: window.portfolioApp.currentChapter,
      phoneScale: window.portfolioApp.chapter01Group.scale.x,
      contactScale: window.portfolioApp.chapter03Group.scale.x,
      reducedMotion: window.portfolioApp.reducedMotion.matches,
      trackerTop: document.getElementById('chapter-tracker').getBoundingClientRect().top,
      projectsLink: !!document.querySelector('a[href="https://ccpaschoal.github.io/hamburgueria/"]')
    }));
    assert.equal(mobileStatus.chapter, 0, 'Teaser deve terminar imediatamente com movimento reduzido');
    assert.ok(mobileStatus.phoneScale > 0.9 && mobileStatus.contactScale < 1,
      'Celular da frente deve ter tamanho legível e o contato deve caber no móvel');
    assert.equal(mobileStatus.reducedMotion, true);
    assert.ok(mobileStatus.trackerTop < 100, 'Tracker móvel deve ficar longe dos objetos centrais');
    assert.equal(mobileStatus.projectsLink, true, 'Projetos precisam de links HTML acessíveis');
  } finally {
    await mobile.close();
  }

  assert.equal(await page.locator('#chapter-tracker button').count(), 4,
    'Tracker precisa de quatro botões acessíveis pelo teclado');

  // TESTE 9: Verificação de Erros no Console
  assert.deepEqual(errors, [], `Nenhum erro de runtime deve ocorrer: ${errors.join(', ')}`);

  console.log('✔ TODOS OS TESTES DE NARRATIVA CONTÍNUA E MASTER TIMELINE PASSARAM COM 100% DE SUCESSO!');
} finally {
  await browser.close();
  await server.close();
}
