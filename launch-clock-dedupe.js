(() => {
  'use strict';

  // Random-build launch fix only.
  // During the row-by-row entrance, wall-live.js keeps activated clock cells
  // synced to the current time. Track the state already requested for each
  // macro flap so an identical request cannot restart its animation.

  const CENTRE_START = 8;
  const DIGIT_STARTS = [1, 6, 12, 17, 23, 28];
  const DIGIT_ROWS = 5;
  const DIGIT_COLS = 4;
  const coordToDigit = new Map();

  DIGIT_STARTS.forEach((digitStart, digitIndex) => {
    for (let row = 0; row < DIGIT_ROWS; row += 1) {
      for (let col = 0; col < DIGIT_COLS; col += 1) {
        const globalRowOneBased = 1 + row + 1;
        const globalColOneBased = CENTRE_START + digitStart + col + 1;
        coordToDigit.set(`${globalColOneBased},${globalRowOneBased}`, digitIndex);
      }
    }
  });

  let wrappedCount = 0;
  let suppressedCount = 0;
  let passedCount = 0;
  const passedByDigit = [0, 0, 0, 0, 0, 0];
  const suppressedByDigit = [0, 0, 0, 0, 0, 0];

  function publish(lastEvent = null) {
    window.__launchClockDedupe = {
      wrappedCount,
      suppressedCount,
      passedCount,
      passedByDigit: [...passedByDigit],
      suppressedByDigit: [...suppressedByDigit],
      lastEvent,
      updatedAt: Date.now()
    };
  }

  function wrapFlap(flap) {
    if (!flap || flap._launchDedupeWrapped) return;
    const digitIndex = coordToDigit.get(flap.dataset.coord);
    if (digitIndex == null) return;
    if (typeof flap.update !== 'function') return;

    const originalUpdate = flap.update.bind(flap);
    flap._launchDedupeWrapped = true;
    flap._launchRequestedValue = null;
    flap._launchRequestedMacro = null;

    flap.update = (value, macro = false, delay = 0, halfMs) => {
      const nextValue = String(value ?? ' ').slice(0, 1) || ' ';
      const nextMacro = Boolean(macro);
      const launching = document.body.classList.contains('launching');

      if (launching) {
        if (
          flap._launchRequestedValue === nextValue
          && flap._launchRequestedMacro === nextMacro
        ) {
          suppressedCount += 1;
          suppressedByDigit[digitIndex] += 1;
          publish({
            type: 'suppressed',
            digitIndex,
            coord: flap.dataset.coord,
            macro: nextMacro
          });
          return;
        }
        flap._launchRequestedValue = nextValue;
        flap._launchRequestedMacro = nextMacro;
        passedCount += 1;
        passedByDigit[digitIndex] += 1;
        publish({
          type: 'passed',
          digitIndex,
          coord: flap.dataset.coord,
          macro: nextMacro
        });
      } else {
        flap._launchRequestedValue = null;
        flap._launchRequestedMacro = null;
      }

      originalUpdate(nextValue, nextMacro, delay, halfMs);
    };

    wrappedCount += 1;
    publish({ type: 'wrapped', digitIndex, coord: flap.dataset.coord });
  }

  function scan() {
    document.querySelectorAll('.flap[data-coord]').forEach(wrapFlap);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  window.addEventListener('load', () => {
    scan();
    window.setTimeout(scan, 50);
    window.setTimeout(scan, 250);
  }, { once: true });
})();
