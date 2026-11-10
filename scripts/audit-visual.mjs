import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT_DIR = path.resolve('debug-screens');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runAudit() {
  console.log('--- INICIANDO AUDITORIA VISUAL E TELEMETRIA THREE.JS ---');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const milestones = [
    { chapter: '00 - MATRIZ', progress: 0.00, slug: 'act00-progress-0.00' },
    { chapter: '01 - PELÍCULA', progress: 0.35, slug: 'act01-progress-0.35' },
    { chapter: '02 - DIGITAL', progress: 0.60, slug: 'act02-progress-0.60' },
    { chapter: '03 - ARQUIVO', progress: 0.90, slug: 'act03-progress-0.90' }
  ];

  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile', width: 390, height: 844 }
  ];

  const results = [];

  for (const vp of viewports) {
    console.log(`\n=== VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ===`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.portfolioApp && window.portfolioApp.renderer);

    // Dispara o teaser se necessário
    const isTeaser = await page.evaluate(() => document.body.classList.contains('is-teaser'));
    if (isTeaser) {
      await page.evaluate(() => {
        document.body.classList.remove('is-teaser');
        window.portfolioApp.triggerTeaserReveal();
      });
      await page.waitForTimeout(1400);
    }

    for (const ms of milestones) {
      // Ajusta o progresso da narrativa
      await page.evaluate((p) => {
        window.portfolioApp.setProgress(p);
        window.portfolioApp.renderer.render(window.portfolioApp.scene, window.portfolioApp.camera);
      }, ms.progress);
      await page.waitForTimeout(400);

      // Salva screenshot
      const screenPath = path.join(OUT_DIR, `${vp.name}-${ms.slug}.png`);
      await page.screenshot({ path: screenPath });
      console.log(`[Screenshot] Salvo: ${screenPath}`);

      // Coleta Telemetria Three.js
      const telemetry = await page.evaluate(() => {
        const app = window.portfolioApp;
        const renderer = app.renderer;
        const info = renderer.info;
        const cam = app.camera;

        const roundPos = (pos) => pos ? { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) } : null;

        return {
          renderCalls: info.render.calls,
          triangles: info.render.triangles,
          points: info.render.points,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          camera: {
            fov: cam.fov,
            aspect: Number(cam.aspect.toFixed(3)),
            position: roundPos(cam.position)
          },
          objects: {
            leftPolaroid: roundPos(app.leftPolaroid?.position),
            centerPolaroid: roundPos(app.centerPolaroid?.position),
            rightPolaroid: roundPos(app.rightPolaroid?.position),
            kodakFilmStrip: roundPos(app.kodakFilmStrip?.position),
            phone: roundPos(app.phoneHero?.position || app.phone?.position),
            vhsPlayer: roundPos(app.vhsPlayer?.position),
            vhsCassette: roundPos(app.vhsCassette?.position)
          },
          visibility: {
            c00: app.chapter00Group?.visible,
            c01: app.chapter01Group?.visible,
            c02: app.chapter02Group?.visible,
            c03: app.chapter03Group?.visible
          }
        };
      });

      results.push({ viewport: vp.name, milestone: ms, telemetry });
    }
    await page.close();
  }

  await browser.close();

  console.log('\n--- RELATÓRIO E TELEMETRIA COLETADA ---');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(path.join(OUT_DIR, 'telemetry-report.json'), JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nTelemetria salva em: ${path.join(OUT_DIR, 'telemetry-report.json')}`);
}

runAudit().catch(err => {
  console.error('Falha na auditoria:', err);
  process.exit(1);
});
