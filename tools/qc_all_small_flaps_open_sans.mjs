import { chromium } from 'playwright';
import fs from 'node:fs';

const report = { passed: false, checks: {}, errors: [] };
const browser = await chromium.launch({ headless: true });
const forkPage = await browser.newPage({ viewport: { width: 3840, height: 804 } });
const sourcePage = await browser.newPage({ viewport: { width: 3840, height: 804 } });

forkPage.on('pageerror', error => report.errors.push(String(error)));
forkPage.on('console', message => {
  if (message.type() === 'error') report.errors.push(message.text());
});

const fixedQuery = '?noanim=1&cycle=0&testutc=2026-08-04T22:22:22%2B10:00&temp=17.4&condition=CLEAR&winddir=WNW&wind=15&hum=58&rain=0.2';

const transformY = transform => {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/);
  return match ? Math.round(Number(match[1])) : null;
};

const macroClip = async currentPage => currentPage.evaluate(() => {
  const first = document.querySelector('[data-coord="10,2"]')?.getBoundingClientRect();
  const last = document.querySelector('[data-coord="40,6"]')?.getBoundingClientRect();
  if (!first || !last) throw new Error('Macro crop coordinates unavailable');
  return {
    x: Math.round(first.left),
    y: Math.round(first.top),
    width: Math.round(last.right - first.left),
    height: Math.round(last.bottom - first.top),
  };
});

const readMacroState = currentPage => currentPage.evaluate(() => {
  const rows = [];
  for (let row = 2; row <= 6; row += 1) {
    let line = '';
    for (let col = 10; col <= 40; col += 1) {
      line += document.querySelector(`[data-coord="${col},${row}"]`)?.dataset.macro === '1' ? '1' : '0';
    }
    rows.push(line);
  }
  return rows;
});

const normalise = value => String(value || '').replace(/\s+/g, ' ').trim();
const extract = (text, regex) => normalise(text.match(regex)?.[0]);

try {
  await forkPage.goto(`http://127.0.0.1:8000/49x7.html${fixedQuery}`, { waitUntil: 'networkidle' });
  await forkPage.waitForSelector('.flap[data-coord]');
  await forkPage.evaluate(() => document.fonts.ready);
  await forkPage.waitForFunction(
    () => document.querySelectorAll('.centre-flap[data-macro="1"]').length === 66,
    null,
    { timeout: 15000 }
  );
  await forkPage.waitForTimeout(300);
  await forkPage.evaluate(() => document.body.classList.remove('colon-dim', 'launching'));

  const fork = await forkPage.evaluate(() => {
    const visible = flap => flap.dataset.macro === '0' && flap.dataset.value.trim();
    const header = [...document.querySelectorAll('.centre-flap')]
      .find(flap => flap.dataset.coord.endsWith(',1') && visible(flap));
    const footer = [...document.querySelectorAll('.centre-flap')]
      .find(flap => flap.dataset.coord.endsWith(',7') && visible(flap));
    const office = [...document.querySelectorAll('.office-flap')].find(visible);

    const inspect = flap => {
      const top = flap.querySelector('.panel.top span');
      const bottom = flap.querySelector('.panel.bottom span');
      const topStyle = getComputedStyle(top);
      const bottomStyle = getComputedStyle(bottom);
      return {
        value: flap.dataset.value,
        family: topStyle.fontFamily,
        weight: topStyle.fontWeight,
        size: topStyle.fontSize,
        topTransform: topStyle.transform,
        bottomTransform: bottomStyle.transform,
      };
    };

    const stage = document.querySelector('#stage').getBoundingClientRect();
    return {
      stageWidth: Math.round(stage.width),
      stageHeight: Math.round(stage.height),
      flapCount: document.querySelectorAll('.flap').length,
      macroActiveCount: document.querySelectorAll('.centre-flap[data-macro="1"]').length,
      header: inspect(header),
      footer: inspect(footer),
      office: inspect(office),
      openSansLoaded: document.fonts.check('700 34px "Open Sans"'),
      macroTop: getComputedStyle(document.documentElement).getPropertyValue('--macro-top').trim(),
      macroBottom: getComputedStyle(document.documentElement).getPropertyValue('--macro-bottom').trim(),
    };
  });
  const forkMacroState = await readMacroState(forkPage);
  await forkPage.screenshot({ path: 'qc/open-sans-3-fixed-3840x804.png' });
  const forkClip = await macroClip(forkPage);
  await forkPage.screenshot({ path: 'qc/open-sans-3-macro-fork.png', clip: forkClip });

  await sourcePage.goto(`http://127.0.0.1:8001/49x7.html${fixedQuery}`, { waitUntil: 'networkidle' });
  await sourcePage.waitForSelector('.flap[data-coord]');
  await sourcePage.waitForFunction(
    () => document.querySelectorAll('.flap[data-macro="1"]').length === 66,
    null,
    { timeout: 15000 }
  );
  await sourcePage.waitForTimeout(300);
  await sourcePage.evaluate(() => document.body.classList.remove('colon-dim', 'launching'));
  const sourceMacroState = await readMacroState(sourcePage);
  const sourceClip = await macroClip(sourcePage);
  await sourcePage.screenshot({ path: 'qc/open-sans-3-macro-source.png', clip: sourceClip });

  await forkPage.goto('http://127.0.0.1:8000/49x7-random.html?seed=111&noanim=1&cycle=0', { waitUntil: 'networkidle' });
  await forkPage.waitForFunction(() => window.__randomOfficeState?.current?.length === 4);
  const random = await forkPage.evaluate(() => structuredClone(window.__randomOfficeState));
  await forkPage.screenshot({ path: 'qc/open-sans-3-random-3840x804.png' });

  const sourceJs = fs.readFileSync('/tmp/original-wall/wall-live.js', 'utf8');
  const forkJs = fs.readFileSync('wall-live.js', 'utf8');
  const sourceCss = fs.readFileSync('/tmp/original-wall/wall-live.css', 'utf8');
  const forkCss = fs.readFileSync('wall-live.css', 'utf8');

  const jsMacroParts = [
    /const CENTRE_START = .*?;/,
    /const CENTRE_COLS = .*?;/,
    /const DIGITS_4X5 = \{.*?\n  \};/s,
    /const DIGIT_STARTS = .*?;/,
    /const COLON_GAPS = .*?;/,
    /const COLON_ROWS = .*?;/,
  ];
  const sourceMacroSignature = jsMacroParts.map(regex => extract(sourceJs, regex)).join('|');
  const forkMacroSignature = jsMacroParts.map(regex => extract(forkJs, regex)).join('|');

  const cssMacroParts = [
    /--macro-top: .*?;/,
    /--macro-bottom: .*?;/,
    /\.panel\.top\.macro-face, \.flip-half\.top-flip\.macro-face \{.*?\}/s,
    /\.panel\.bottom\.macro-face, \.flip-half\.bottom-flip\.macro-face \{.*?\}/s,
    /\.macro-face span \{.*?\}/s,
  ];
  const sourceMacroCssSignature = cssMacroParts.map(regex => extract(sourceCss, regex)).join('|');
  const forkMacroCssSignature = cssMacroParts.map(regex => extract(forkCss, regex)).join('|');

  const textSamples = [fork.header, fork.footer, fork.office];
  const allOpenSansBold = textSamples.every(sample =>
    sample.family.includes('Open Sans') && sample.weight === '700' && sample.size === '34px'
  );
  const allTopHalvesLifted = textSamples.every(sample =>
    transformY(sample.topTransform) === 0 && transformY(sample.bottomTransform) === 2
  );

  report.checks = {
    nativeStage: fork.stageWidth === 3840 && fork.stageHeight === 804,
    flapCount: fork.flapCount === 343,
    allSmallTextUsesOpenSansBold: allOpenSansBold,
    allSmallTextTopLiftedTwoPixels: allTopHalvesLifted,
    openSansHostedAndLoaded: fork.openSansLoaded,
    original4x5JsSourceMatch: Boolean(sourceMacroSignature) && sourceMacroSignature === forkMacroSignature,
    original4x5CssSourceMatch: Boolean(sourceMacroCssSignature) && sourceMacroCssSignature === forkMacroCssSignature,
    original4x5CellStateMatch: JSON.stringify(forkMacroState) === JSON.stringify(sourceMacroState),
    originalMacroPalette: fork.macroTop === '#f7f7f5' && fork.macroBottom === '#d7d7d3',
    heavy222222Pattern: fork.macroActiveCount === 66,
    randomOpeningUnique: new Set(random.current).size === 4,
    randomOpeningNotDefault: random.current.join('|') !== 'ADELAIDE|BRISBANE|CAIRNS|CANBERRA',
    noForkPageErrors: report.errors.length === 0,
  };
  report.details = {
    fork,
    random,
    forkMacroState,
    sourceMacroState,
    macroClip: forkClip,
  };
  report.passed = Object.values(report.checks).every(Boolean);
  if (!report.passed) process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('qc/open-sans-3-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
