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
  
  // Ativa Ato 01 (Fita 35mm em ~0.35)
  await page.evaluate(() => {
    window.portfolioApp.masterTimeline.progress(0.35);
  });
  await page.waitForTimeout(100);
  const act01 = await page.evaluate(() => ({
    c00Visible: window.portfolioApp.chapter00Group.visible,
    c01Visible: window.portfolioApp.chapter01Group.visible,
    stripX: window.portfolioApp.kodakFilmStrip.position.x
  }));
  assert.equal(act01.c01Visible, true, 'Ato 01 (Fita 35mm) deve estar visível em progresso 0.35');

  // Ativa Ato 02 (Smartphones em ~0.60)
  await page.evaluate(() => {
    window.portfolioApp.masterTimeline.progress(0.60);
  });
  await page.waitForTimeout(100);
  const act02 = await page.evaluate(() => ({
    c01Visible: window.portfolioApp.chapter01Group.visible,
    c02Visible: window.portfolioApp.chapter02Group.visible,
    phoneCount: window.portfolioApp.phonesList.length
  }));
  assert.equal(act02.c02Visible, true, 'Ato 02 (Smartphones) deve estar visível em progresso 0.60');
  assert.equal(act02.phoneCount, 1, 'Ato digital deve ter um celular central');

  // Ativa Ato 03 (VHS em ~0.85)
  await page.evaluate(() => {
    window.portfolioApp.masterTimeline.progress(0.85);
  });
  await page.waitForTimeout(100);
  const act03 = await page.evaluate(() => ({
    c02Visible: window.portfolioApp.chapter02Group.visible,
    c03Visible: window.portfolioApp.chapter03Group.visible
  }));
  assert.equal(act03.c03Visible, true, 'Ato 03 (VHS Deck) deve estar visível em progresso 0.85');

  // TESTE 6: Tracker Lateral Editorial (4 Itens e Navegação)
  console.log('-> Testando Tracker Lateral (00 MATRIZ, 01 PELÍCULA, 02 DIGITAL, 03 ARQUIVO)...');
  const trackerInfo = await page.evaluate(() => {
    const items = document.querySelectorAll('.tracker-list li');
    const texts = Array.from(items).map(li => li.textContent.trim());
    return {
      count: items.length,
      texts
    };
  });
  assert.equal(trackerInfo.count, 4, 'Tracker deve conter exatamente 4 atos');
  assert.ok(trackerInfo.texts[0].includes('MATRIZ'), 'Ato 0 deve ser MATRIZ');
  assert.ok(trackerInfo.texts[1].includes('PELÍCULA'), 'Ato 1 deve ser PELÍCULA');
  assert.ok(trackerInfo.texts[2].includes('DIGITAL'), 'Ato 2 deve ser DIGITAL');
  assert.ok(trackerInfo.texts[3].includes('ARQUIVO'), 'Ato 3 deve ser ARQUIVO');

  // Clique no item 01 do Tracker
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
  assert.ok(trackerNavResult.timelineProgress > 0.15 && trackerNavResult.timelineProgress < 0.45, 'Timeline deve ter interpolado para o Ato 01');

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

  // TESTE 8: Verificação de Hardware 3D, Proporção 4:5 e Interatividade Tátil
  console.log('-> Testando fita, celular central, reprodutor VHS e raycaster...');
  const engineeringStatus = await page.evaluate(() => {
    const app = window.portfolioApp;
    const stripWidth = app.totalFilmWidth;
    const phoneList = app.phonesList;
    const clickables = app.clickableObjects;

    return {
      stripWidthValid: stripWidth > 1400 && stripWidth < 2800,
      phoneCount: phoneList.length,
      centerPhoneX: phoneList[0]?.userData?.targetPos?.x,
      clickableCount: clickables.length,
      hasUrls: clickables.every(c => !!c.userData?.url)
    };
  });

  assert.ok(engineeringStatus.stripWidthValid, 'Largura total da fita 35mm deve ser compacta sem dead scroll');
  assert.equal(engineeringStatus.phoneCount, 1, 'Deve existir um celular central');
  assert.equal(engineeringStatus.centerPhoneX, 0, 'Smartphone central em X = 0');
  assert.ok(engineeringStatus.clickableCount >= 5, 'Celular e quatro botões VHS devem continuar clicáveis');
  assert.ok(engineeringStatus.hasUrls, 'Todos os alvos interativos devem possuir URL válida');

  // A passagem para a película mantém as duas cenas visíveis enquanto a fita se aproxima.
  for (const [time, expected] of [
    [21, [true, false, false, false]],
    [24, [true, true, false, false]],
    [25, [true, true, false, false]],
    [26, [true, true, false, false]],
    [28, [false, true, false, false]],
    [47, [false, true, false, false]],
    [50, [false, false, true, false]],
    [73, [false, false, true, false]],
    [75, [false, false, false, true]]
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
        filmZ: app.kodakFilmStrip.position.z,
        filmScale: app.kodakFilmStrip.scale.x
      };
    };
    return { before: sample(22), middle: sample(25), after: sample(28), reversed: sample(20) };
  });
  assert.ok(transition.before.filmZ < transition.middle.filmZ && transition.middle.filmZ < transition.after.filmZ,
    'Fita deve se aproximar continuamente da câmera');
  assert.ok(transition.before.filmScale < transition.middle.filmScale && transition.middle.filmScale < transition.after.filmScale,
    'Fita deve ganhar escala sem salto');
  assert.ok(transition.middle.opacity > 0 && transition.middle.opacity < 1,
    'Polaroids devem desaparecer gradualmente');
  assert.equal(transition.reversed.opacity, 1, 'Voltar a rolagem deve restaurar as polaroids');

  const filmAndPhones = await page.evaluate(() => {
    const app = window.portfolioApp;
    const film = app.kodakFilmStrip.children.find(child =>
      child.geometry?.parameters?.width === app.totalFilmWidth);
    const position = film.geometry.attributes.position;
    const rowStart = film.geometry.parameters.widthSegments + 1;
    let nearZero = rowStart + 1;
    for (let i = rowStart + 1; i < rowStart * 2 - 1; i++) {
      if (Math.abs(position.getX(i) + film.position.x) <
          Math.abs(position.getX(nearZero) + film.position.x)) nearZero = i;
    }
    const slope = (position.getZ(nearZero + 1) - position.getZ(nearZero - 1)) /
      (position.getX(nearZero + 1) - position.getX(nearZero - 1));
    return {
      filmSegmentsX: film.geometry.parameters.widthSegments,
      filmSegmentsY: film.geometry.parameters.heightSegments,
      slope,
      firstSlideRotY: app.kodakFilmStrip.children.find(child =>
        child.position.x === 0 && child.geometry?.parameters?.width === 176)?.rotation.y
    };
  });
  assert.ok(filmAndPhones.filmSegmentsX >= 160 && filmAndPhones.filmSegmentsY === 2,
    'Fita deve ter malha subdividida em X e Y');
  assert.ok(filmAndPhones.slope > 0, 'Fita deve subir em Z próximo ao primeiro slide');
  assert.ok(filmAndPhones.firstSlideRotY < 0, 'Fotograma deve seguir a tangente da fita');

  assert.equal(await page.locator('#phone-stage .phone-copy').count(), 2,
    'O palco do celular precisa dos dois títulos');
  assert.equal(await page.locator('#phone-stage button').count(), 2,
    'O carrossel precisa de setas anterior e próxima');

  const siteChange = await page.evaluate(async () => {
    const app = window.portfolioApp;
    const before = app.phonesList[0].userData.url;
    await app.showSite(1);
    return { before, after: app.phonesList[0].userData.url, index: app.activeSiteIndex };
  });
  assert.notEqual(siteChange.after, siteChange.before, 'Seta deve trocar o site mostrado no celular');
  assert.equal(siteChange.index, 1, 'Carrossel deve avançar um item');

  const phoneClick = await page.evaluate(() => {
    const app = window.portfolioApp;
    app.masterTimeline.time(60);
    app.scene.updateMatrixWorld(true);
    const point = app.phonesList[0].getWorldPosition(app.camera.position.clone()).project(app.camera);
    const x = (point.x + 1) * app.width / 2;
    const y = (1 - point.y) * app.height / 2;
    window.open = (...args) => { window.__opened = args; return null; };
    const clicked = app.handleClick(x, y);
    return { clicked, opened: window.__opened };
  });
  assert.equal(phoneClick.clicked, true, 'Smartphone central deve responder ao clique');
  assert.equal(phoneClick.opened?.[1], '_blank', 'Link deve abrir durante o gesto do clique');
  assert.match(phoneClick.opened?.[2] || '', /noopener/, 'Nova aba não deve acessar a página de origem');
  assert.equal(phoneClick.opened?.[0], siteChange.after, 'Clique no celular deve abrir o site exibido');

  const vhsDock = await page.evaluate(() => {
    const app = window.portfolioApp;
    app.masterTimeline.time(76);
    const arriving = app.vhsCassette.position.y;
    app.masterTimeline.time(90);
    return { hasPlayer: !!app.vhsPlayer, arriving, docked: app.vhsCassette.position.y };
  });
  assert.equal(vhsDock.hasPlayer, true, 'A cassette precisa de um reprodutor 3D');
  assert.ok(vhsDock.arriving < -200 && Math.abs(vhsDock.docked + 30) < 1,
    'Cassette deve subir e encaixar no reprodutor');

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
      phoneScale: window.portfolioApp.chapter02Group.scale.x,
      vhsScale: window.portfolioApp.chapter03Group.scale.x,
      reducedMotion: window.portfolioApp.reducedMotion.matches,
      trackerTop: document.getElementById('chapter-tracker').getBoundingClientRect().top,
      projectsLink: !!document.querySelector('a[href="https://ccpaschoal.github.io/hamburgueria/"]')
    }));
    assert.equal(mobileStatus.chapter, 0, 'Teaser deve terminar imediatamente com movimento reduzido');
    assert.ok(mobileStatus.phoneScale > 0.9 && mobileStatus.vhsScale < 1,
      'Celular único deve ter tamanho legível no móvel');
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
