/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const readNote = locator => locator.evaluate(el => {
  const text = node => node.nodeType === 3 ? node.textContent : node.nodeName === 'BR'
    ? (node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n') : Array.from(node.childNodes).map(text).join('');
  return Array.from(el.children).map(text).join('\n');
});
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Local demo only');
const wait = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Condition timed out'); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'wardflow-demo', value: '1', domain: 'localhost', path: '/' }]);
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/wards`);
    await page.getByRole('button', { name: /^Show ward:/ }).first().click();
    await page.locator('article:visible a').first().click();
    await page.waitForURL('**/patients/**');
    const patientUrl = page.url();
    const note = page.locator('[role="textbox"][id^="progress-"]').first();
    const problem = note.locator('xpath=ancestor::details[1]');
    const problemToggle = problem.locator(':scope > summary');
    const openNote = async () => {
      if (!(await note.isVisible())) await problemToggle.click();
      await wait(() => note.isEditable());
    };
    assert.equal(await page.locator('[role="textbox"][id^="progress-"]:visible').count(), 0);
    await openNote();
    await wait(async () => await note.isEditable());
    await wait(async () => await note.isEditable());
    const original = await readNote(note);
    const status = note.locator('xpath=ancestor::div[div/span[@role="status"]][1]').getByRole('status');
    const saved = () => wait(async () => await status.innerText() === 'บันทึกแล้ว');
    await context.setOffline(true);
    await note.fill('REGRESSION draft survives browser Back');
    await page.goBack();
    assert.equal(page.url(), `${base}/wards`);
    await context.setOffline(false);
    await page.goto(patientUrl); await openNote();
    await wait(async () => await note.isEditable());
    assert.equal(await readNote(note), 'REGRESSION draft survives browser Back');
    await saved();
    await page.reload(); await openNote();
    assert.equal(await readNote(note), 'REGRESSION draft survives browser Back');
    console.log('PASS offline Back, draft recovery, autosave and reload');

    // Drop only writes so the document can reload while the server is unreachable for saving.
    await page.route('**/*', route => route.request().method() === 'POST' ? route.abort() : route.continue());
    await note.fill('REGRESSION draft survives reload');
    await wait(async () => (await status.innerText()).includes('ไม่สำเร็จ'));
    await page.reload(); await openNote();
    await wait(async () => await note.isEditable());
    assert.equal(await readNote(note), 'REGRESSION draft survives reload');
    await page.unroute('**/*');
    await saved();
    console.log('PASS unsaved draft survives full reload and retries');

    // Delayed response from the previous mount must not erase newer typing.
    let delayed = false;
    await page.route('**/*', async route => {
      if (!delayed && route.request().method() === 'POST') {
        delayed = true;
        const response = await route.fetch();
        await new Promise(r => setTimeout(r, 2000));
        await route.fulfill({ response });
      } else await route.continue();
    });
    await note.fill('REGRESSION request completed before unmount');
    await wait(async () => delayed);
    await note.fill('REGRESSION latest typing before Back');
    await page.goBack();
    await page.goto(patientUrl); await openNote();
    await wait(async () => await note.isEditable());
    assert.equal(await readNote(note), 'REGRESSION latest typing before Back');
    await saved();
    await page.unroute('**/*');
    await page.reload(); await openNote();
    assert.equal(await readNote(note), 'REGRESSION latest typing before Back');
    console.log('PASS late response after unmount does not discard newer draft');

    await note.fill('REGRESSION obsolete snapshot text'); await saved();
    await note.fill('REGRESSION final snapshot text'); await saved();
    await page.goto(`${patientUrl}/summary-note`);
    await page.getByText('REGRESSION final snapshot text', { exact: true }).first().waitFor();
    const summary = await page.locator('body').innerText();
    assert(!summary.includes('REGRESSION obsolete snapshot text'));
    assert(summary.includes('REGRESSION final snapshot text'));
    await page.goto(patientUrl); await openNote();
    await wait(() => note.isEditable());
    assert.equal(await page.getByText(/^Progress history \(/).count(), 0);
    assert(!(await page.locator('body').innerText()).includes('REGRESSION obsolete snapshot text'));
    await note.fill(original); await saved();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('wardflow:progress-draft:')).length), 0);
    console.log('PASS summary uses latest note, history removed, saved draft removed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
