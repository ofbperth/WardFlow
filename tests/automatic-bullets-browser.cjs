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
    await page.waitForURL('**/patients/**', { waitUntil: 'domcontentloaded' });
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
        await note.evaluate(el => {
          el.editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
          el.editor.commands.setTextSelection(1);
          el.focus();
        });
      };
      await open();
      for (const text of ['x', 'Test', 'ก', 'ไข้', 'กิ', 'กำ', '🙂']) {
        await note.evaluate((el, text) => {
          const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
          el.editor.commands.setContent({ type: 'doc', content: [{ type: 'bulletList', content: [
            { type: 'listItem', content: [paragraph('First')] },
            { type: 'listItem', content: [paragraph(text)] },
          ] }] });
          el.editor.commands.setTextSelection(el.editor.state.doc.content.size - 3);
          el.focus();
        }, text);
        await saved(); // Keep setup outside the deletion's undo history group.
        let remaining = text;
        while (remaining) {
          await page.keyboard.press('Backspace');
          const items = await note.locator('li').allTextContents();
          assert.equal(items.length, 2, `${kind}: Backspace preserves both bullet lines (${text})`);
          assert.equal(items[0], 'First', 'previous line is untouched');
          assert(items[1].length < remaining.length, `${kind}: each Backspace deletes text (${text})`);
          remaining = items[1];
        }
        assert.equal(await note.evaluate(el => el.editor.state.selection.$from.parentOffset), 0);
        if (text === 'x') {
          await page.keyboard.press('Control+z');
          assert.deepEqual(await note.locator('li').allTextContents(), ['First', 'x']);
          await page.keyboard.press('Control+Shift+z');
          assert.deepEqual(await note.locator('li').allTextContents(), ['First', '']);
        }
        await saved(); await page.reload({ waitUntil: 'domcontentloaded' }); await open();
        assert.deepEqual(await note.locator('li').allTextContents(), ['First', ''],
          `${kind}: empty bullet persists after saving and reloading (${text})`);
      }
      // Mobile keyboards may mutate the DOM without a usable keydown event.
      await note.evaluate(el => {
        el.editor.commands.setTextSelection(el.editor.state.doc.content.size - 3);
        el.editor.commands.insertContent('x');
        el.focus();
      });
      await note.evaluate(el => {
        const paragraph = el.querySelectorAll('li > p')[1];
        paragraph.textContent = '';
        window.getSelection().collapse(paragraph, 0);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      });
      await wait(async () => await note.evaluate(el => el.editor.state.selection.$from.parent.textContent === ''));
      assert.deepEqual(await note.locator('li').allTextContents(), ['First', '']);
      console.log(`PASS ${kind}: delete all English/Thai/emoji text, same-line caret, undo/redo, autosave/reload and DOM-only deletion`);
      for (const trailingText of ['', 'Second']) {
        await note.evaluate((el, text) => {
          const paragraph = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
          el.editor.commands.setContent({ type: 'doc', content: [{ type: 'bulletList', content: [
            { type: 'listItem', content: [paragraph('First')] },
            { type: 'listItem', content: [paragraph(text)] },
          ] }] });
          el.focus();
          window.getSelection().collapse(el.querySelectorAll('li > p')[1], 0);
        }, trailingText);
        await page.keyboard.press('Backspace');
        assert.equal(await note.locator(':scope > p').count(), 1, 'first Backspace lifts the item');
        await page.keyboard.press('Backspace');
        assert.deepEqual(await note.locator('li').allTextContents(), [`First${trailingText}`],
          `${kind}: second Backspace removes the line boundary instead of recreating the item`);
        assert.equal(await note.locator('p').count(), 1);
        await page.keyboard.press('Backspace');
        assert.equal(await note.textContent(), `Firs${trailingText}`, 'next Backspace deletes text at the join');
        await saved(); await page.reload({ waitUntil: 'domcontentloaded' }); await open();
        assert.deepEqual(await note.locator('li').allTextContents(), [`Firs${trailingText}`], 'deleted line stays deleted after reload');
      }
      console.log(`PASS ${kind}: repeated Backspace removes empty/nonempty list lines without a bullet/text loop`);
      // Exercise insertion routes that have no clipboard event, plus HTML with
      // hard breaks as mobile notes apps may provide. These are browser tests,
      // not a claim to reproduce the physical Android long-press menu.
      const bulkLines = ['24/10/69 มีไข้ BT 38.0 C', 'due to organism pending identification', 'on treatment (30/9/69 - 20/10/69) ** follow up'];
      for (const route of ['insertText', 'insertContent', 'dom', 'htmlPaste']) {
        await reset();
        await wait(async () => {
          const status = await panel.getByRole('status', { includeHidden: true }).textContent();
          return status === 'บันทึกแล้ว' || (status === 'พร้อมพิมพ์' && await note.textContent() === '');
        });
        const text = bulkLines.map((line, i) => `${i ? '  ' : ''}• ${line}`).join('\n');
        if (route === 'insertText') await page.keyboard.insertText(text);
        else if (route === 'insertContent') await note.evaluate((el, text) => {
          el.editor.commands.insertContent({ type: 'paragraph', content: [{ type: 'text', text }] });
        }, text);
        else if (route === 'dom') await note.evaluate((el, text) => {
          const p = el.querySelector('p');
          p.textContent = text;
          const selection = window.getSelection();
          selection.collapse(p.firstChild, text.length);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }, text);
        else await note.evaluate((el, text) => {
          const data = new DataTransfer();
          data.setData('text/plain', text);
          data.setData('text/html', `<div>${text.replaceAll('\n', '<br>')}</div>`);
          el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
        }, text);
        await wait(async () => await note.locator('li').count() === 3);
        assert.deepEqual(await note.locator('li').allTextContents(), bulkLines, `${kind}: ${route}`);
        assert.equal(await note.locator(':scope > ul').count(), 1);
        await page.keyboard.press('Control+z');
        await wait(async () => await note.textContent() === '');
        await page.keyboard.press('Control+Shift+z');
        await wait(async () => await note.locator('li').count() === 3);
        await saved(); await page.reload(); await open();
        assert.deepEqual(await note.locator('li').allTextContents(), bulkLines);
      }
      console.log(`PASS ${kind}: bulk insertText/insertContent/DOM mutation/HTML paste, exact text, undo/redo, autosave/reload`);
      for (let iteration = 0; iteration < 12; iteration++) {
        await reset();
        await page.keyboard.type('- Parent', { delay: 0 });
        await page.keyboard.press('Enter');
        await page.keyboard.type('Child', { delay: 0 });
        await page.keyboard.press('Tab');
        await page.keyboard.press('Home');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(' tail', { delay: 0 });
        assert.deepEqual(await note.locator('li').allTextContents(), ['Parent', ' tailChild'], `rapid input ${kind} #${iteration}`);
        assert.equal(await note.locator('ul ul').count(), 0);
      }
      await saved(); await page.reload(); await open();
      assert.deepEqual(await note.locator('li').allTextContents(), ['Parent', ' tailChild']);
      console.log(`PASS ${kind}: 12 zero-delay typing/Enter/Tab/Home/Backspace sequences, exact text and reload`);
      await reset();
      await page.keyboard.insertText('Indented body');
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      assert.equal(await note.locator('p').getAttribute('data-indent'), '2');
      assert(await note.evaluate(el => el === document.activeElement));
      await page.keyboard.press('Home');
      await page.keyboard.press('Backspace');
      assert.equal(await note.locator('p').getAttribute('data-indent'), '1');
      await saved(); await page.reload(); await open();
      assert.equal(await note.locator('p').getAttribute('data-indent'), '1');
      await panel.getByRole('button', { name: 'Heading', exact: true }).click();
      await note.locator('h3').click();
      await page.keyboard.press('Tab');
      assert.equal(await note.locator('h3').getAttribute('data-indent'), '2');
      await page.keyboard.press('Home');
      await page.keyboard.press('Backspace');
      assert.equal(await note.locator('h3').getAttribute('data-indent'), '1');
      await reset();
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
      await reset(); await page.keyboard.type('-5');
      assert.equal(await note.locator('li').count(), 0, 'negative numbers remain plain text');
      await reset(); await page.keyboard.type('- ');
      await page.keyboard.insertText('Typed dash bullet');
      assert.equal(await note.locator('li').innerText(), 'Typed dash bullet');
      await reset(); await paste('- on Letermovir 20/9/69-now\n• ติดตามอาการ');
      await wait(async () => await note.locator('li').count() === 2);
      await saved(); await page.reload(); await open();
      assert.equal(await note.locator('li').count(), 2);
      await note.locator('li > p').last().click();
      await page.keyboard.press('Tab');
      assert.equal(await note.locator('ul ul li').innerText(), 'ติดตามอาการ');
      await page.keyboard.press('Home');
      await page.keyboard.press('Backspace');
      assert.equal(await note.locator('ul ul').count(), 0);
      await page.keyboard.press('Tab'); await saved(); await page.reload(); await open();
      assert.equal(await note.locator('ul ul li').innerText(), 'ติดตามอาการ');
      await page.goto(`${patientUrl}/summary-note`);
      const summary = await page.getByLabel('Summary note preview').innerText();
      assert(summary.includes('• on Letermovir 20/9/69-now'));
      assert(!summary.includes('• •'));
      assert(!summary.includes('wardflow-note:'));
      await page.goto(patientUrl); await open(); await reset(); await saved();
      console.log(`PASS ${kind}: dash/bullet typing and paste, Tab/Backspace body/heading/nested bullets, undo, autosave/reload and Summary Note`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
