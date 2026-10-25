/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Local demo only');
const wait = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Condition timed out'); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'wardflow-demo', value: '1', domain: 'localhost', path: '/' }]);
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/wards`);
    await page.getByRole('button', { name: /^Show ward:/ }).first().click();
    await page.locator('article:visible a').first().click();
    await page.waitForURL('**/patients/**');
    const patientUrl = page.url();
    const note = page.locator('[role="textbox"][id^="progress-"]').first();
    await wait(() => note.isEditable());
    const panel = note.locator('xpath=ancestor::div[div/span[@role="status"]][1]');
    const saved = () => wait(async () => await panel.getByRole('status').innerText() === 'บันทึกแล้ว');
    const h = panel.getByRole('button', { name: 'Heading', exact: true });
    const b = panel.getByRole('button', { name: 'Body', exact: true });
    assert.equal(await h.locator('span').evaluate(el => getComputedStyle(el).fontWeight), '700');
    assert.equal(await b.locator('span').evaluate(el => getComputedStyle(el).fontWeight), '300');
    await note.fill('FORMAT หัวข้อทดสอบ');
    await h.click();
    assert.equal(await h.getAttribute('aria-pressed'), 'true');
    assert.equal(await note.locator('h3').innerText(), 'FORMAT หัวข้อทดสอบ');
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await b.click(); await page.keyboard.insertText('FORMAT เนื้อหาปกติ');
    assert.equal(await b.getAttribute('aria-pressed'), 'true');
    assert.equal(await note.locator('p').last().innerText(), 'FORMAT เนื้อหาปกติ');
    await saved(); await page.reload();
    await wait(() => note.isEditable());
    assert.equal(await note.locator('h3').innerText(), 'FORMAT หัวข้อทดสอบ');
    assert.equal(await note.locator('p').last().innerText(), 'FORMAT เนื้อหาปกติ');
    const styles = await note.evaluate(el => ({ h: getComputedStyle(el.querySelector('h3')).fontSize, b: getComputedStyle(el.querySelector('p')).fontSize, weight: getComputedStyle(el.querySelector('h3')).fontWeight }));
    assert(parseFloat(styles.h) > parseFloat(styles.b)); assert(Number(styles.weight) >= 700);
    await panel.screenshot({ path: '.codex/progress-format-desktop.png' });
    console.log('PASS heading/body typing, caret retention, autosave/reload and typography');

    await note.locator('h3').click(); await b.click(); await saved();
    assert.equal(await note.locator('h3').count(), 0);
    await page.keyboard.press('Control+z');
    assert.equal(await note.locator('h3').count(), 1);
    await saved();
    console.log('PASS change existing paragraph to Body and undo restores Heading');

    await page.route('**/*', route => route.request().method() === 'POST' ? route.abort() : route.continue());
    await note.locator('h3').click(); await page.keyboard.press('End'); await page.keyboard.insertText(' offline');
    assert((await note.locator('h3').innerText()).endsWith(' offline'), 'typed heading: ' + await note.locator('h3').innerText());
    const draftBefore = await page.evaluate(() => Object.entries(sessionStorage).filter(([k]) => k.startsWith('wardflow:progress-draft:')));
    await page.reload();
    await wait(() => note.isEditable());
    assert((await note.locator('h3').innerText()).endsWith(' offline'), JSON.stringify({ restored: await note.innerText(), draftBefore }));
    await page.unroute('**/*'); await saved();
    console.log('PASS formatted draft survives reload while saves are unavailable');

    assert.equal(await page.getByText(/^Progress history \(/).count(), 0);
    await page.goto(`${patientUrl}/summary-note`);
    await page.getByText('FORMAT เนื้อหาปกติ', { exact: true }).first().waitFor();
    assert(!(await page.locator('body').innerText()).includes('wardflow-note:v1:'));
    console.log('PASS no history UI and clean Summary Note');

    await page.goto(patientUrl); await wait(() => note.isEditable());
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await panel.screenshot({ path: '.codex/progress-format-mobile.png' });
    await note.fill(''); await saved(); await page.reload();
    await wait(() => note.isEditable());
    assert.equal((await note.textContent()).trim(), '');
    assert.equal(await note.locator('h3').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS mobile layout and clearing formatted content');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
