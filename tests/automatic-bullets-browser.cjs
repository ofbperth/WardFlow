/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Local demo only');
const wait = async fn => {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Timed out');
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addCookies([{ name: 'wardflow-demo', value: '1', domain: 'localhost', path: '/' }]);
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/wards`);
    await page.getByRole('button', { name: /^Show ward:/ }).first().click();
    await page.locator('article:visible a').first().click();
    await page.waitForURL('**/patients/**');
    const patientUrl = page.url();
    const paste = async text => {
      await page.evaluate(text => navigator.clipboard.writeText(text), text);
      await page.keyboard.press('Control+v');
    };
    for (const kind of ['Progress note', 'Underlying diseases']) {
      const note = kind === 'Progress note'
        ? page.locator('[role="textbox"][id^="progress-"]').first()
        : page.getByRole('region', { name: kind, exact: true }).getByRole('textbox', { includeHidden: true });
      const panel = kind === 'Progress note'
        ? note.locator('xpath=ancestor::div[div/span[@role="status"]][1]')
        : page.getByRole('region', { name: kind, exact: true });
      const open = async () => {
        if (!await note.isVisible()) {
          if (kind === 'Progress note') await note.locator('xpath=ancestor::details[1]').locator(':scope > summary').click();
          else await panel.getByRole('button', { name: 'U/D', exact: true }).click();
        }
        await wait(() => note.isEditable());
      };
      const saved = () => wait(async () => await panel.getByRole('status', { includeHidden: true }).textContent() === 'บันทึกแล้ว');
      const reset = async () => {
        await note.fill('');
        await panel.getByRole('button', { name: 'Body', exact: true }).click();
      };
      await open(); await reset();
      await page.keyboard.insertText('•'); await page.keyboard.type(' ');
      await page.keyboard.insertText('on Letermovir 20/9/69-now');
      assert.equal(await note.locator('li').innerText(), 'on Letermovir 20/9/69-now');
      await page.keyboard.press('Enter'); await page.keyboard.insertText('continued');
      assert.equal(await note.locator('li').count(), 2);
      await saved(); await page.reload(); await open();
      assert.equal(await note.locator('li').count(), 2);
      await reset();
      await saved(); // Separate the reset from the paste's undo history group.
      await paste('• on Letermovir 20/9/69-now\n• ติดตามอาการ\nPlain paragraph');
      await wait(async () => await note.locator('li').count() === 2);
      assert.equal(await note.locator(':scope > ul').count(), 1);
      assert.equal(await note.locator('li').first().innerText(), 'on Letermovir 20/9/69-now');
      assert.equal(await note.locator(':scope > p').last().innerText(), 'Plain paragraph');
      await page.keyboard.press('Control+z');
      await wait(async () => await note.locator('li').count() === 0);
      assert.equal(await note.locator('li').count(), 0, 'undo paste and automatic conversion together');
      await paste('Text • stays inline');
      assert.equal(await note.locator('li').count(), 0);
      await page.keyboard.press('End'); await paste('• also inline');
      assert.equal(await note.locator('li').count(), 0);
      await reset(); await page.keyboard.type('- ');
      assert.equal(await note.locator('li').count(), 0, 'unrequested shortcuts remain disabled');
      await reset(); await paste('• on Letermovir 20/9/69-now\n• ติดตามอาการ');
      await wait(async () => await note.locator('li').count() === 2);
      await saved(); await page.reload(); await open();
      assert.equal(await note.locator('li').count(), 2);
      await page.goto(`${patientUrl}/summary-note`);
      const summary = await page.getByLabel('Summary note preview').innerText();
      assert(summary.includes('• on Letermovir 20/9/69-now'));
      assert(!summary.includes('• •'));
      assert(!summary.includes('wardflow-note:'));
      await page.goto(patientUrl); await open(); await reset(); await saved();
      console.log(`PASS ${kind}: typing, Enter, paste, adjacent items, inline text, undo, autosave/reload and Summary Note`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
