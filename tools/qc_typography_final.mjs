import { chromium } from 'playwright';
import fs from 'node:fs';

const report = { passed: false, checks: {}, errors: [] };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 3840, height: 804 } });
page.on('pageerror', error => report.errors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error') report.errors.push(message.text());
});

const readTransformY = transform => {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/);
  return match ? Math.round(Number(match[1])) : null;
};

try {
  const fixedUrl = 'http://127.0.0.1:8000/49x7.html?noanim=1&cycle=0&testutc=2026-08-04T22:22:22%2B10:00&temp=17.4&condition=CLEAR&winddir=WNW&wind=15&hum=58&rain=0.2';
  await page.goto(fixedUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.flap[data-coord]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.querySelectorAll('.centre-flap[data-macro="1"]').length === 72,
    null,
    { timeout: 12000 }
  );

  const fixed = await page.evaluate(() => {
    const centre = [...document.querySelectorAll('.centre-flap')]
      .find(flap => flap.dataset.macro === '0' && flap.dataset.value.trim());
    const office = [...document.querySelectorAll('.office-flap')]
      .find(flap => flap.dataset.value.trim());
    const centreTop = centre.querySelector('.panel.top span');
    const officeTop = office.querySelector('.panel.top span');
    const officeBottom = office.querySelector('.panel.bottom span');
    const stageRect = document.querySelector('#stage').getBoundingClientRect();
    return {
      stageWidth: Math.round(stageRect.width),
      stageHeight: Math.round(stageRect.height),
      flapCount: document.querySelectorAll('.flap').length,
      centreFlaps: document.querySelectorAll('.centre-flap').length,
      officeFlaps: document.querySelectorAll('.office-flap').length,
      macroActiveCount: document.querySelectorAll('.centre-flap[data-macro="1"]').length,
      centreFontFamily: getComputedStyle(centreTop).fontFamily,
      centreFontSize: getComputedStyle(centreTop).fontSize,
      centreFontWeight: getComputedStyle(centreTop).fontWeight,
      centreTransform: getComputedStyle(centreTop).transform,
      officeFontFamily: getComputedStyle(officeTop).fontFamily,
      officeFontSize: getComputedStyle(officeTop).fontSize,
      officeFontWeight: getComputedStyle(officeTop).fontWeight,
      officeTopTransform: getComputedStyle(officeTop).transform,
      officeBottomTransform: getComputedStyle(officeBottom).transform,
      openSansLoaded: document.fonts.check('700 34px "Open Sans"'),
      mpbLoaded: document.fonts.check('400 38px "MP-B"')
    };
  });
  await page.screenshot({ path: 'qc/open-sans-bold-final-fixed-3840x804.png' });

  await page.goto('http://127.0.0.1:8000/49x7-random.html?seed=91&noanim=1&cycle=0', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__randomOfficeState?.current?.length === 4);
  const random = await page.evaluate(() => structuredClone(window.__randomOfficeState));
  await page.screenshot({ path: 'qc/open-sans-bold-final-random-3840x804.png' });

  const officeTopY = readTransformY(fixed.officeTopTransform);
  const officeBottomY = readTransformY(fixed.officeBottomTransform);
  const centreY = readTransformY(fixed.centreTransform);

  report.checks = {
    nativeStage: fixed.stageWidth === 3840 && fixed.stageHeight === 804,
    flapCount: fixed.flapCount === 343,
    zoneCounts: fixed.centreFlaps === 231 && fixed.officeFlaps === 112,
    heavy222222Pattern: fixed.macroActiveCount === 72,
    centreUsesOriginalFace: fixed.centreFontFamily.includes('MP-B'),
    centreUsesOriginalMetrics: fixed.centreFontSize === '38px' && fixed.centreFontWeight === '400' && centreY === 4,
    officeUsesOpenSans: fixed.officeFontFamily.includes('Open Sans'),
    officeUsesBold: fixed.officeFontWeight === '700',
    officeFontSize: fixed.officeFontSize === '34px',
    officeTopLiftedTwoPixels: officeTopY === 0 && officeBottomY === 2,
    openSansHostedAndLoaded: fixed.openSansLoaded,
    mpbHostedAndLoaded: fixed.mpbLoaded,
    randomUnique: new Set(random.current).size === 4,
    noPageErrors: report.errors.length === 0
  };
  report.details = { fixed, random, officeTopY, officeBottomY, centreY };
  report.passed = Object.values(report.checks).every(Boolean);
  if (!report.passed) process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('qc/open-sans-bold-final-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
