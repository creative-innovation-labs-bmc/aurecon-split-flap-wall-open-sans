(() => {
  'use strict';

  const STAGE_W = 3840;
  const STAGE_H = 804;
  const TOTAL_COLS = 49;
  const TOTAL_ROWS = 7;
  const COLS_PER_SECTION = 7;
  const SECTION_COUNT = 7;
  const FLAP_W = 72;
  const GAP_X = 6;
  const SECTION_W = 540;
  const SIDE_COLS = 8;
  const CENTRE_START = 8;
  const CENTRE_COLS = 33;
  const NORMAL_HALF_MS = 300;
  const FAST_HALF_MS = 105;
  const OFFICE_PAGE_MS = 14000;
  const WEATHER_REFRESH_MS = 5 * 60 * 1000;
  const COLON_PULSE_MS = 160;
  const OFFICE_CHAR_STAGGER_MS = 46;
  const OFFICE_LINE_STEP_MS = 520;
  const CARD_STAGGER_MS = 1540;
  const LAUNCH_CELL_STAGGER_MS = 20;
  const LAUNCH_ROW_STEP_MS = 1120;
  const WEATHER_BOOT_TIMEOUT_MS = 1800;

  const OFFICE_NAMES = [
    { display: 'ADELAIDE', country: 'AUS', tz: 'Australia/Adelaide' },
    { display: 'BRISBANE', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'CAIRNS', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'CANBERRA', country: 'AUS', tz: 'Australia/Sydney' },
    { display: 'DARWIN', country: 'AUS', tz: 'Australia/Darwin' },
    { display: 'GLADSTON', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'GOLDCOST', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'MACKAY', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'MAROOCHY', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'NEWCASTL', country: 'AUS', tz: 'Australia/Sydney' },
    { display: 'PERTH', country: 'AUS', tz: 'Australia/Perth' },
    { display: 'SYDNEY', country: 'AUS', tz: 'Australia/Sydney' },
    { display: 'TOOWOOMB', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'TOWNSVIL', country: 'AUS', tz: 'Australia/Brisbane' },
    { display: 'BEIJING', country: 'CHN', tz: 'Asia/Shanghai' },
    { display: 'SHANGHAI', country: 'CHN', tz: 'Asia/Shanghai' },
    { display: 'HONGKONG', country: 'HKG', tz: 'Asia/Hong_Kong' },
    { display: 'JAKARTA', country: 'IDN', tz: 'Asia/Jakarta' },
    { display: 'MACAU', country: 'MAC', tz: 'Asia/Macau' },
    { display: 'JOHOR', country: 'MYS', tz: 'Asia/Kuala_Lumpur' },
    { display: 'PETALING', country: 'MYS', tz: 'Asia/Kuala_Lumpur' },
    { display: 'AUCKLAND', country: 'NZL', tz: 'Pacific/Auckland' },
    { display: 'CHRISTCH', country: 'NZL', tz: 'Pacific/Auckland' },
    { display: 'HAMILTON', country: 'NZL', tz: 'Pacific/Auckland' },
    { display: 'TAURANGA', country: 'NZL', tz: 'Pacific/Auckland' },
    { display: 'WELLINGT', country: 'NZL', tz: 'Pacific/Auckland' },
    { display: 'MANILA', country: 'PHL', tz: 'Asia/Manila' },
    { display: 'SINGAPOR', country: 'SGP', tz: 'Asia/Singapore' },
    { display: 'BANGKOK', country: 'THA', tz: 'Asia/Bangkok' },
    { display: 'HOCHIMIN', country: 'VNM', tz: 'Asia/Ho_Chi_Minh' }
  ].map((office, index) => ({ ...office, id: index }));

  const DIGITS_4X5 = {
    '0': ['0110', '1001', '1001', '1001', '0110'],
    '1': ['0010', '0110', '0010', '0010', '0111'],
    '2': ['1110', '0001', '0110', '1000', '1111'],
    '3': ['1110', '0001', '0110', '0001', '1110'],
    '4': ['1001', '1001', '1111', '0001', '0001'],
    '5': ['1111', '1000', '1110', '0001', '1110'],
    '6': ['0110', '1000', '1110', '1001', '0110'],
    '7': ['1111', '0001', '0010', '0100', '0100'],
    '8': ['0110', '1001', '0110', '1001', '0110'],
    '9': ['0110', '1001', '0111', '0001', '0110']
  };

  const DIGIT_STARTS = [1, 6, 12, 17, 23, 28];
  const COLON_GAPS = [[10, 11], [21, 22]];
  const COLON_ROWS = [2, 4];

  const params = new URLSearchParams(window.location.search);
  const randomOfficeMode = params.get('randommode') === '1'
    || /49x7-random\.html$/i.test(window.location.pathname);
  const randomDebug = params.get('randomdebug') === '1';
  const randomIntervalMs = Math.max(2500, Number(params.get('interval')) || OFFICE_PAGE_MS);
  const noAnimation = params.get('noanim') === '1';
  const cycleOffices = params.get('cycle') !== '0';
  const fixedDate = parseFixedDate(params.get('testutc'));
  const shieldMode = params.get('shield') === '1'
    || (params.get('shield') !== '0' && /Android|SHIELD|Enplug/i.test(navigator.userAgent));
  if (params.get('debug') === '1') document.body.classList.add('debug');
  if (shieldMode) document.body.classList.add('shield-mode');

  const stage = document.getElementById('stage');
  const board = document.getElementById('board');
  const cells = Array.from({ length: TOTAL_ROWS }, () => Array(TOTAL_COLS));
  const formatters = new Map();
  let officePage = Number(params.get('page') || 0);
  let currentOfficeCards = null;
  let randomDeck = [];
  let randomDeckIndex = 0;
  let randomSeen = new Set();
  let lastSecond = -1;
  let lastMinuteKey = '';
  let colonTimer = 0;
  let launchClockTimer = 0;
  const activeLaunchClockCells = new Set();
  let weather = {
    temp: params.get('temp') || '--.-',
    condition: params.get('condition') || 'WAIT',
    windDir: params.get('winddir') || '--',
    windSpeed: params.get('wind') || '--',
    humidity: params.get('hum') || '--',
    rain: params.get('rain') || '--',
    updatedUtc: null
  };

  function parseFixedDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function now() {
    return fixedDate ? new Date(fixedDate.getTime()) : new Date();
  }

  function seededGenerator(seedValue) {
    let state = (Number(seedValue) || 1) >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seededRandom = params.has('seed') ? seededGenerator(params.get('seed')) : null;

  function randomValue() {
    if (seededRandom) return seededRandom();
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
    return Math.random();
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomValue() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function updateRandomDebugState() {
    if (!randomOfficeMode) return;
    window.__randomOfficeState = {
      current: (currentOfficeCards || []).filter(Boolean).map((office) => office.display),
      seen: [...randomSeen],
      seenCount: randomSeen.size,
      deckIndex: randomDeckIndex,
      deckLength: randomDeck.length
    };
  }

  function resetRandomDeck(avoidVisible = false) {
    const visibleIds = new Set((currentOfficeCards || []).filter(Boolean).map((office) => office.id));
    let candidate = shuffle(OFFICE_NAMES);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const defaultOpening = candidate.slice(0, 4).every((office, index) => office.id === index);
      const repeatsVisible = avoidVisible
        && candidate.slice(0, 4).some((office) => visibleIds.has(office.id));
      if (!defaultOpening && !repeatsVisible) break;
      candidate = shuffle(OFFICE_NAMES);
    }
    randomDeck = candidate;
    randomDeckIndex = 0;
    randomSeen = new Set();
  }

  function initialiseRandomOffices() {
    if (!randomOfficeMode || currentOfficeCards) return;
    resetRandomDeck(false);
    currentOfficeCards = randomDeck.slice(0, 4);
    randomDeckIndex = 4;
    randomSeen = new Set(currentOfficeCards.map((office) => office.id));
    updateRandomDebugState();
    if (randomDebug) console.log('[random offices] initial', currentOfficeCards.map((office) => office.display));
  }

  function advanceRandomOffices() {
    if (!randomOfficeMode) return;
    if (randomDeckIndex >= randomDeck.length) resetRandomDeck(true);

    const remaining = randomDeck.length - randomDeckIndex;
    const count = Math.min(4, remaining);
    const batch = randomDeck.slice(randomDeckIndex, randomDeckIndex + count);
    const targetSlots = count === 2 ? [0, 1] : [0, 1, 2, 3].slice(0, count);

    batch.forEach((office, index) => {
      if (randomSeen.has(office.id)) {
        console.error('Random office repeated before the full deck was shown:', office.display);
        return;
      }
      currentOfficeCards[targetSlots[index]] = office;
      randomSeen.add(office.id);
    });
    randomDeckIndex += count;
    updateRandomDebugState();
    if (randomDebug) {
      console.log('[random offices] batch', batch.map((office) => office.display), `${randomSeen.size}/${OFFICE_NAMES.length}`);
    }
    renderOfficeCards(now(), 'page');
  }

  function sanitise(value, maxLength, fallback = '--') {
    const cleaned = String(value ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9.°%-]/g, '')
      .slice(0, maxLength);
    return cleaned || fallback;
  }

  function fitStage() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    const scaledWidth = STAGE_W * scale;
    const scaledHeight = STAGE_H * scale;
    stage.style.left = `${Math.round((window.innerWidth - scaledWidth) / 2)}px`;
    stage.style.top = `${Math.round((window.innerHeight - scaledHeight) / 2)}px`;
    stage.style.transform = `scale(${scale})`;
  }

  function globalCellX(col) {
    const section = Math.floor(col / COLS_PER_SECTION);
    const local = col % COLS_PER_SECTION;
    return section * SECTION_W + local * (FLAP_W + GAP_X);
  }

  function applyMacroFace(element, isMacro) {
    element.classList.toggle('macro-face', Boolean(isMacro));
  }

  function createFlap(row, col) {
    const flap = document.createElement('div');
    flap.className = 'flap';
    flap.dataset.value = ' ';
    flap.dataset.macro = '0';
    flap.dataset.coord = `${col + 1},${row + 1}`;
    flap.innerHTML = [
      '<div class="panel top"><span> </span></div>',
      '<div class="panel bottom"><span> </span></div>',
      '<div class="flip-half top-flip"><span> </span></div>',
      '<div class="flip-half bottom-flip"><span> </span></div>'
    ].join('');

    const faces = {
      top: flap.querySelector('.panel.top'),
      bottom: flap.querySelector('.panel.bottom'),
      topFlip: flap.querySelector('.top-flip'),
      bottomFlip: flap.querySelector('.bottom-flip')
    };
    const spans = {
      top: faces.top.querySelector('span'),
      bottom: faces.bottom.querySelector('span'),
      topFlip: faces.topFlip.querySelector('span'),
      bottomFlip: faces.bottomFlip.querySelector('span')
    };

    flap._delayTimer = 0;
    flap._timerA = 0;
    flap._timerB = 0;

    flap.cancel = () => {
      window.clearTimeout(flap._delayTimer);
      window.clearTimeout(flap._timerA);
      window.clearTimeout(flap._timerB);
      flap.classList.remove('flipping');
      flap._delayTimer = 0;
      flap._timerA = 0;
      flap._timerB = 0;
    };

    flap.setStatic = (value, macro = false) => {
      const next = String(value ?? ' ').slice(0, 1) || ' ';
      flap.cancel();
      flap.dataset.value = next;
      flap.dataset.macro = macro ? '1' : '0';
      Object.values(spans).forEach((span) => { span.textContent = next; });
      Object.values(faces).forEach((face) => applyMacroFace(face, macro));
    };

    flap.update = (value, macro = false, delay = 0, halfMs = NORMAL_HALF_MS) => {
      const next = String(value ?? ' ').slice(0, 1) || ' ';
      const nextMacro = Boolean(macro);
      const current = flap.dataset.value || ' ';
      const currentMacro = flap.dataset.macro === '1';
      if (current === next && currentMacro === nextMacro) return;

      const run = () => {
        flap.cancel();
        const liveCurrent = flap.dataset.value || ' ';
        const liveMacro = flap.dataset.macro === '1';
        if (liveCurrent === next && liveMacro === nextMacro) return;

        if (noAnimation || halfMs <= 1) {
          flap.setStatic(next, nextMacro);
          return;
        }

        spans.top.textContent = liveCurrent;
        spans.bottom.textContent = liveCurrent;
        spans.topFlip.textContent = liveCurrent;
        spans.bottomFlip.textContent = next;
        applyMacroFace(faces.top, liveMacro);
        applyMacroFace(faces.bottom, liveMacro);
        applyMacroFace(faces.topFlip, liveMacro);
        applyMacroFace(faces.bottomFlip, nextMacro);

        flap.style.setProperty('--flip-half-ms', `${halfMs}ms`);
        flap.classList.remove('flipping');
        void flap.offsetWidth;
        flap.classList.add('flipping');

        flap._timerA = window.setTimeout(() => {
          spans.top.textContent = next;
          applyMacroFace(faces.top, nextMacro);
        }, halfMs);

        flap._timerB = window.setTimeout(() => {
          Object.values(spans).forEach((span) => { span.textContent = next; });
          Object.values(faces).forEach((face) => applyMacroFace(face, nextMacro));
          flap.dataset.value = next;
          flap.dataset.macro = nextMacro ? '1' : '0';
          flap.classList.remove('flipping');
        }, halfMs * 2 + 20);
      };

      if (delay > 0) flap._delayTimer = window.setTimeout(run, delay);
      else run();
    };

    return flap;
  }

  function buildBoard() {
    for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex += 1) {
      const section = document.createElement('section');
      section.className = 'section';
      section.dataset.section = `SECTION ${sectionIndex + 1}`;
      section.setAttribute('aria-hidden', 'true');

      for (let row = 0; row < TOTAL_ROWS; row += 1) {
        for (let localCol = 0; localCol < COLS_PER_SECTION; localCol += 1) {
          const globalCol = sectionIndex * COLS_PER_SECTION + localCol;
          const flap = createFlap(row, globalCol);
          cells[row][globalCol] = flap;
          section.appendChild(flap);
        }
      }
      board.appendChild(section);
    }

    [CENTRE_START, CENTRE_START + CENTRE_COLS].forEach((col) => {
      const divider = document.createElement('div');
      divider.className = 'zone-divider';
      divider.style.left = `${globalCellX(col)}px`;
      board.appendChild(divider);
    });

    addSplitColons();
    stage.dataset.debug = '49×7 | 8 / 33 / 8 | 4×5 clock | BOM Melbourne Olympic Park';
  }

  function addSplitColons() {
    COLON_GAPS.forEach(([leftLocal, rightLocal]) => {
      COLON_ROWS.forEach((row) => {
        const leftCell = cells[row][CENTRE_START + leftLocal];
        const rightCell = cells[row][CENTRE_START + rightLocal];
        const leftHalf = document.createElement('span');
        const rightHalf = document.createElement('span');
        leftHalf.className = 'colon-half left';
        rightHalf.className = 'colon-half right';
        leftCell.appendChild(leftHalf);
        rightCell.appendChild(rightHalf);
      });
    });
  }

  function setCell(row, col, char = ' ', macro = false, delay = 0, halfMs = NORMAL_HALF_MS) {
    if (row < 0 || row >= TOTAL_ROWS || col < 0 || col >= TOTAL_COLS) return;
    cells[row][col].update(char, macro, delay, halfMs);
  }

  function writeText(row, startCol, width, text, delayBase = 0, instant = false, charStaggerMs = 9) {
    const value = String(text ?? '').slice(0, width).padEnd(width, ' ');
    for (let index = 0; index < width; index += 1) {
      const flap = cells[row][startCol + index];
      if (instant) flap.setStatic(value[index], false);
      else flap.update(value[index], false, delayBase + index * charStaggerMs, NORMAL_HALF_MS);
    }
  }

  function launchDelay(row, col) {
    return row * LAUNCH_ROW_STEP_MS + col * LAUNCH_CELL_STAGGER_MS;
  }

  function centred(text, width) {
    const clean = String(text ?? '').slice(0, width);
    const remaining = width - clean.length;
    const left = Math.floor(remaining / 2);
    return `${' '.repeat(left)}${clean}${' '.repeat(remaining - left)}`;
  }

  function centredOfficeName(text, width, isRight = false) {
    const clean = String(text ?? '').slice(0, width);
    const remaining = width - clean.length;
    let left = Math.floor(remaining / 2);
    // On the right, five- and seven-letter names move one flap right to
    // align visually with the inset country and time rows. Six-letter names
    // remain truly centred.
    if (isRight && (clean.length === 5 || clean.length === 7) && remaining > 0) {
      left = Math.min(left + 1, remaining);
    }
    return `${' '.repeat(left)}${clean}${' '.repeat(remaining - left)}`;
  }

  function formatterFor(timeZone) {
    if (!formatters.has(timeZone)) {
      formatters.set(timeZone, new Intl.DateTimeFormat('en-AU', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23'
      }));
    }
    return formatters.get(timeZone);
  }

  function timeParts(timeZone, date = now()) {
    const parts = formatterFor(timeZone).formatToParts(date);
    const mapped = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    if (mapped.hour === '24') mapped.hour = '00';
    return mapped;
  }

  function fullTimeFor(timeZone, date = now()) {
    const part = timeParts(timeZone, date);
    return `${part.hour}:${part.minute}:${part.second}`;
  }

  function shortTimeFor(timeZone, date = now()) {
    const part = timeParts(timeZone, date);
    return `${part.hour}:${part.minute}`;
  }

  function officeTimeLayout(timeZone, width = SIDE_COLS, date = now()) {
    const part = timeParts(timeZone, date);
    const text = width === SIDE_COLS - 1
      ? ` ${part.hour} ${part.minute} `
      : ` ${part.hour} ${part.minute}  `;
    return {
      text,
      colonLocalCol: 3
    };
  }

  function visiblePageOffices(page) {
    if (randomOfficeMode) {
      initialiseRandomOffices();
      return currentOfficeCards;
    }
    const capacity = 4;
    const pageCount = Math.ceil(OFFICE_NAMES.length / capacity);
    officePage = ((page % pageCount) + pageCount) % pageCount;
    const start = officePage * capacity;
    return Array.from({ length: capacity }, (_, index) => OFFICE_NAMES[(start + index) % OFFICE_NAMES.length]);
  }

  function addMiniColon(targetCell) {
    if (!targetCell || targetCell.querySelector('.mini-colon')) return;
    const colon = document.createElement('span');
    colon.className = 'mini-colon';
    targetCell.appendChild(colon);
  }

  function ensureOfficeMiniColons() {
    const rightStart = TOTAL_COLS - SIDE_COLS;
    const positions = [
      [2, 3], [6, 3],
      [2, rightStart + 4], [6, rightStart + 4]
    ];
    positions.forEach(([row, col]) => addMiniColon(cells[row][col]));
  }

  function renderOfficeCards(date = now(), mode = 'steady') {
    const offices = visiblePageOffices(officePage);
    const rightStart = TOTAL_COLS - SIDE_COLS;
    const cards = [
      { office: offices[0], startCol: 0, startRow: 0, order: 0, isRight: false },
      { office: offices[1], startCol: 0, startRow: 4, order: 1, isRight: false },
      { office: offices[2], startCol: rightStart, startRow: 0, order: 2, isRight: true },
      { office: offices[3], startCol: rightStart, startRow: 4, order: 3, isRight: true }
    ];

    cards.forEach((card) => {
      const detailStartCol = card.isRight ? card.startCol + 1 : card.startCol;
      const detailWidth = card.isRight ? SIDE_COLS - 1 : SIDE_COLS;
      const timeLayout = officeTimeLayout(card.office.tz, detailWidth, date);
      const lines = [
        { startCol: card.startCol, width: SIDE_COLS, text: centredOfficeName(card.office.display, SIDE_COLS, card.isRight) },
        { startCol: detailStartCol, width: detailWidth, text: centred(card.office.country, detailWidth) },
        { startCol: detailStartCol, width: detailWidth, text: timeLayout.text }
      ];

      lines.forEach((line, lineIndex) => {
        let delayBase = 0;
        let charStagger = 12;
        if (mode === 'launch') {
          delayBase = launchDelay(card.startRow + lineIndex, line.startCol);
          charStagger = LAUNCH_CELL_STAGGER_MS;
        } else if (mode === 'page') {
          delayBase = card.order * CARD_STAGGER_MS + lineIndex * OFFICE_LINE_STEP_MS;
          charStagger = OFFICE_CHAR_STAGGER_MS;
        } else if (mode === 'minute') {
          delayBase = card.order * 80;
          charStagger = 18;
        }
        writeText(
          card.startRow + lineIndex,
          line.startCol,
          line.width,
          line.text,
          delayBase,
          noAnimation,
          charStagger
        );
      });
    });

    ensureOfficeMiniColons();
  }


  function drawPattern(pattern, rowStart, colStart, mode = 'steady', delayBase = 0, halfMs = NORMAL_HALF_MS) {
    pattern.forEach((line, row) => {
      [...line].forEach((value, col) => {
        const globalRow = rowStart + row;
        const globalCol = colStart + col;
        const delay = mode === 'launch'
          ? launchDelay(globalRow, globalCol)
          : delayBase + row * 8 + col * 5;
        setCell(globalRow, globalCol, ' ', value === '1', delay, halfMs);
      });
    });
  }

  function renderClock(date = now(), mode = 'steady') {
    const time = fullTimeFor('Australia/Melbourne', date);
    const digits = [time[0], time[1], time[3], time[4], time[6], time[7]];
    digits.forEach((digit, index) => {
      drawPattern(
        DIGITS_4X5[digit],
        1,
        CENTRE_START + DIGIT_STARTS[index],
        mode,
        mode === 'transition' ? index * 65 : 0,
        mode === 'transition' ? FAST_HALF_MS : NORMAL_HALF_MS
      );
    });
  }

  function clockDigitsAt(date = now()) {
    const time = fullTimeFor('Australia/Melbourne', date);
    return [time[0], time[1], time[3], time[4], time[6], time[7]];
  }

  function updateLaunchClockCell(key, date = now(), halfMs = FAST_HALF_MS) {
    const [digitIndex, row, col] = key.split(':').map(Number);
    const digits = clockDigitsAt(date);
    const pattern = DIGITS_4X5[digits[digitIndex]];
    setCell(
      1 + row,
      CENTRE_START + DIGIT_STARTS[digitIndex] + col,
      ' ',
      pattern[row][col] === '1',
      0,
      halfMs
    );
  }

  function updateActiveLaunchClock(date = now()) {
    activeLaunchClockCells.forEach((key) => updateLaunchClockCell(key, date, FAST_HALF_MS));
    if (randomOfficeMode) {
      window.__launchClockState = {
        activeCells: activeLaunchClockCells.size,
        time: fullTimeFor('Australia/Melbourne', date),
        updatedAt: Date.now()
      };
    }
  }

  function startLiveLaunchClock() {
    activeLaunchClockCells.clear();
    for (let digitIndex = 0; digitIndex < DIGIT_STARTS.length; digitIndex += 1) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const globalRow = 1 + row;
          const globalCol = CENTRE_START + DIGIT_STARTS[digitIndex] + col;
          const key = `${digitIndex}:${row}:${col}`;
          window.setTimeout(() => {
            activeLaunchClockCells.add(key);
            updateLaunchClockCell(key, now(), NORMAL_HALF_MS);
            updateRandomDebugState();
          }, launchDelay(globalRow, globalCol));
        }
      }
    }

    const liveLaunchTick = () => {
      if (!document.body.classList.contains('launching')) return;
      updateActiveLaunchClock(now());
      pulseColons();
      launchClockTimer = window.setTimeout(liveLaunchTick, 1000 - (Date.now() % 1000) + 8);
    };
    launchClockTimer = window.setTimeout(liveLaunchTick, 1000 - (Date.now() % 1000) + 8);
  }


  function pulseColons() {
    window.clearTimeout(colonTimer);
    document.body.classList.add('colon-dim');
    colonTimer = window.setTimeout(() => document.body.classList.remove('colon-dim'), COLON_PULSE_MS);
  }

  function normaliseRain(value) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return '--';
    return n.toFixed(n < 10 ? 1 : 0);
  }

  function renderMetadata(mode = 'steady') {
    const temp = sanitise(weather.temp, 5, '--.-');
    const condition = sanitise(weather.condition, 7, 'LIVE');
    const windDir = sanitise(weather.windDir, 4, '--');
    const windSpeed = sanitise(weather.windSpeed, 3, '--');
    const humidity = sanitise(weather.humidity, 3, '--');
    const rain = sanitise(normaliseRain(weather.rain), 4, '--');

    const header = centred(`MELBOURNE AUSTRALIA ${temp}° ${condition}`, CENTRE_COLS);
    const footerOptions = [
      `WIND ${windDir} ${windSpeed}KMH HUM ${humidity}% RAIN ${rain}MM`,
      `WIND ${windDir}${windSpeed}K HUM${humidity}% RAIN${rain}MM`,
      `${windDir}${windSpeed}K H${humidity}% R${rain}MM`
    ];
    const footerText = footerOptions.find((candidate) => candidate.length <= CENTRE_COLS) || footerOptions.at(-1);
    const footer = centred(footerText, CENTRE_COLS);

    const isLaunch = mode === 'launch';
    writeText(
      0, CENTRE_START, CENTRE_COLS, header,
      isLaunch ? launchDelay(0, CENTRE_START) : 0,
      noAnimation,
      isLaunch ? LAUNCH_CELL_STAGGER_MS : 9
    );
    writeText(
      6, CENTRE_START, CENTRE_COLS, footer,
      isLaunch ? launchDelay(6, CENTRE_START) : 0,
      noAnimation,
      isLaunch ? LAUNCH_CELL_STAGGER_MS : 9
    );
  }


  async function loadWeather(render = true) {
    if (params.has('temp')) {
      if (render) renderMetadata('steady');
      return;
    }
    try {
      const response = await fetch(`weather.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const data = await response.json();
      weather = {
        temp: data.temp_c,
        condition: data.condition || 'LIVE',
        windDir: data.wind_dir,
        windSpeed: data.wind_kmh,
        humidity: data.humidity_pct,
        rain: data.rain_since_9am_mm,
        updatedUtc: data.observation_utc || data.updated_utc || null
      };
      if (weather.updatedUtc) {
        const ageMs = Date.now() - new Date(weather.updatedUtc).getTime();
        if (Number.isFinite(ageMs) && ageMs > 90 * 60 * 1000) weather.condition = 'STALE';
      }
      if (render) renderMetadata('steady');
    } catch (error) {
      console.warn('Weather update unavailable:', error);
      weather.condition = 'WAIT';
      if (render) renderMetadata('steady');
    }
  }

  function tick() {
    const date = now();
    renderClock(date, 'steady');
    const time = fullTimeFor('Australia/Melbourne', date);
    const second = Number(time.slice(-2));
    if (second !== lastSecond) {
      lastSecond = second;
      pulseColons();
    }
    const minuteKey = time.slice(0, 5);
    if (minuteKey !== lastMinuteKey) {
      lastMinuteKey = minuteKey;
      renderOfficeCards(date, 'minute');
    }
    if (!fixedDate) window.setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function startRuntime() {
    const date = now();
    const time = fullTimeFor('Australia/Melbourne', date);
    lastSecond = Number(time.slice(-2));
    lastMinuteKey = time.slice(0, 5);
    document.body.classList.remove('launching');
    window.clearTimeout(launchClockTimer);
    activeLaunchClockCells.clear();
    pulseColons();

    if (cycleOffices && !fixedDate) {
      window.setInterval(() => {
        if (randomOfficeMode) advanceRandomOffices();
        else {
          officePage += 1;
          renderOfficeCards(now(), 'page');
        }
      }, randomOfficeMode ? randomIntervalMs : OFFICE_PAGE_MS);
    }
    if (!fixedDate) {
      window.setInterval(() => loadWeather(true), WEATHER_REFRESH_MS);
      tick();
    }
  }

  async function initialise() {
    fitStage();
    buildBoard();
    document.body.classList.add('launching');
    if (randomOfficeMode) initialiseRandomOffices();

    await Promise.race([loadWeather(false), delay(WEATHER_BOOT_TIMEOUT_MS)]);
    const date = now();
    renderMetadata('launch');
    renderOfficeCards(date, 'launch');
    if (randomOfficeMode && !noAnimation) startLiveLaunchClock();
    else renderClock(date, 'launch');

    const launchEnd = launchDelay(TOTAL_ROWS - 1, TOTAL_COLS - 1) + NORMAL_HALF_MS * 2 + 160;
    window.setTimeout(() => {
      startRuntime();
      loadWeather(true);
    }, noAnimation ? 20 : launchEnd);
  }


  window.addEventListener('resize', fitStage, { passive: true });
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(initialise);
  } else {
    window.setTimeout(initialise, 80);
  }
})();
