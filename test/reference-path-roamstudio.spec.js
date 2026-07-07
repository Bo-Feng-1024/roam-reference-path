const { test, expect } = require('@playwright/test');

// Issue #20 / #18: with Roam Studio loaded, heading blocks (h1/h2/h3) get an
// injected margin-top/margin-bottom on their bullet container (div.controls),
// pushing the bullet onto the heading's vertical centre. The old code positioned
// the connector from the block's top-left corner plus a fixed constant, so it
// missed the shifted bullet. This fix measures the bullet element directly, so
// the connector lands on the real bullet centre wherever Roam Studio put it.
const TOL = 3;

test('connector aligns with the bullet even when Roam Studio shifts it (issue #20)', async ({ page }) => {
  await page.goto('/test/fixtures/roam-studio.html');
  await page.waitForFunction(() => window.__rpReady === true);

  const m = await page.evaluate(() => {
    const { addReferencePath, addStyle, internals } = window.__rp;

    Object.assign(internals.settingsCached, {
      bulletColorHex: 'disabled', bulletScaleFactor: 'disabled',
      referenceColorHex: 'disabled',
      lineColorHex: '#22c55e', lineColorHoverHex: '#22c55e',
      lineWidth: '1px', lineStyle: 'solid', lineRoundness: '2px',
      lineTopOffset: 'auto', lineLeftOffset: 'auto',
    });
    addStyle();
    addReferencePath(internals.blockList.mainView, document.querySelector('[data-testid="active-text"]'));

    const bulletCenter = (main) => {
      const r = main.querySelector('span.bp3-popover-target').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const beforeBox = (main) => {
      const span = main.querySelector('span.bp3-popover-target');
      const cs = getComputedStyle(span, '::before');
      const origin = getComputedStyle(span).position !== 'static' ? span : span.offsetParent;
      const o = origin.getBoundingClientRect();
      const top = parseFloat(cs.top), left = parseFloat(cs.left), w = parseFloat(cs.width), h = parseFloat(cs.height);
      return { top: o.top + top, left: o.left + left, bottom: o.top + top + h, right: o.left + left + w };
    };

    const parent = document.querySelector('[data-testid="parent"]');
    const child = document.querySelector('[data-testid="child"]');
    const parentMainTop = parent.getBoundingClientRect().top;
    const pc = bulletCenter(parent);
    return {
      // how far Roam Studio pushed the bullet below the block top (old constants assumed ~7-9.5px)
      bulletDropFromBlockTop: pc.y - parentMainTop,
      parentCenter: pc,
      childCenter: bulletCenter(child),
      box: beforeBox(parent),
    };
  });

  // sanity: Roam Studio really did shift the bullet well below the block top
  // (far more than the old 7px/9.5px constants), so this is the failure case
  expect(m.bulletDropFromBlockTop).toBeGreaterThan(20);

  // connector starts at the (shifted) parent bullet centre and ends at the child bullet centre
  expect(Math.abs(m.box.top - m.parentCenter.y)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(m.box.left - m.parentCenter.x)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(m.box.bottom - m.childCenter.y)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(m.box.right - m.childCenter.x)).toBeLessThanOrEqual(TOL);
});
