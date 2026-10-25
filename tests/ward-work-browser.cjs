// Run against a local demo server, never production. PLAYWRIGHT_MODULE may point to a bundled runtime.
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
const wait = async (fn) => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Condition timed out'); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'wardflow-demo', value: '1', domain: 'localhost', path: '/' }]);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/wards`);
    await page.getByRole('button', { name: /^Show ward:/ }).first().click();
    const card = page.locator('article:visible').first();
    const patientName = await card.locator('h3').innerText();
    const patientUrl = await card.locator('a').getAttribute('href');
    const count = Number((await card.innerText()).match(/(\d+) open ward work/)[1]);
    await card.getByRole('button', { name: /^Create ward work/ }).click();
    const dialog = page.getByRole('dialog');
    assert((await dialog.innerText()).includes(patientName));
    await dialog.getByLabel('Ward work title').fill(`Browser test ${Date.now()}`);
    await dialog.getByRole('button', { name: 'Create ward work', exact: true }).click();
    await wait(async () => !(await dialog.isVisible()));
    assert.equal(page.url(), `${base}/wards`);
    await wait(async () => (await card.innerText()).includes(`${count + 1} open ward work`));
    console.log('PASS shortcut selects patient, saves, closes, updates count without navigation');
    await page.screenshot({ path: '.codex/ward-work-desktop.png', fullPage: true });

    await page.goto(`${base}${patientUrl}`);
    const note = page.locator('[role="textbox"][id^="progress-"]').first();
    const panel = note.locator('xpath=ancestor::div[div/span[@role="status"]][1]');
    await wait(async () => await note.isEditable());
    const original = await readNote(note);
    const saved = () => wait(async () => (await panel.getByRole('status').innerText()) === 'บันทึกแล้ว');
    const long = Array.from({ length: 90 }, (_, i) => `บรรทัด ${i + 1}: Free text ต่อเนื่อง`).join('\n');
    await note.fill(long); await saved();
    assert(await note.evaluate(el => el.clientHeight >= el.scrollHeight));
    assert((await note.boundingBox()).height > 2000);
    await page.reload(); assert.equal(await readNote(note), long);
    console.log('PASS long text grows without inner scroll and survives reload');

    let delay = true;
    await page.route('**/*', async route => {
      if (delay && route.request().method() === 'POST') { delay = false; await new Promise(r => setTimeout(r, 1800)); }
      await route.continue();
    });
    await note.fill('First request');
    await wait(async () => (await panel.getByRole('status').innerText()).includes('กำลังบันทึก'));
    await note.fill('Typed while first request was saving');
    await saved(); await page.reload();
    assert.equal(await readNote(note), 'Typed while first request was saving');
    await page.unroute('**/*');
    console.log('PASS typing during in-flight save preserves latest text');

    await context.setOffline(true); await note.fill('Offline draft remains');
    await wait(async () => (await panel.getByRole('status').innerText()).includes('ไม่สำเร็จ'));
    assert.equal(await readNote(note), 'Offline draft remains');
    await context.setOffline(false); await saved(); await page.reload();
    assert.equal(await readNote(note), 'Offline draft remains');
    console.log('PASS network failure retains text and retries on reconnect');

    const other = await context.newPage(); await other.goto(page.url());
    const otherNote = other.locator('[role="textbox"][id^="progress-"]').first();
    await note.fill('First window saved'); await saved();
    await otherNote.fill('Second window unsaved text');
    await wait(async () => (await otherNote.locator('xpath=ancestor::div[div/span[@role="status"]][1]').getByRole('status').innerText()).includes('อีกหน้าต่าง'));
    assert.equal(await readNote(otherNote), 'Second window unsaved text');
    await page.reload(); assert.equal(await readNote(note), 'First window saved');
    await other.close();
    console.log('PASS concurrent stale window cannot overwrite saved note');

    await note.fill(''); await saved(); await page.reload(); assert.equal(await readNote(note), '');
    await note.fill(original); await saved();
    await page.setViewportSize({ width: 390, height: 844 });
    await note.fill(long); await saved();
    assert(await note.evaluate(el => el.clientHeight >= el.scrollHeight));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await note.fill(original); await saved();
    await page.screenshot({ path: '.codex/progress-note-mobile.png', fullPage: true });
    console.log('PASS clearing, mobile growth, no horizontal overflow; original text restored');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
