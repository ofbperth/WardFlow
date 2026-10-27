/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Local demo only');
const wait = async fn => { for (let i=0;i<100;i++) { if (await fn()) return; await new Promise(r=>setTimeout(r,200)); } throw Error('Condition timed out'); };
const readNote = locator => locator.evaluate(el => {
 const text = node => node.nodeType === 3 ? node.textContent : node.nodeName === 'BR'
  ? (node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n') : Array.from(node.childNodes).map(text).join('');
 return Array.from(el.children).map(text).join('\n');
});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'wardflow-demo',value:'1',domain:'localhost',path:'/'}]);
  const page=await context.newPage(); page.on('dialog',d=>d.accept());
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const patientId=JSON.parse(fs.readFileSync('.wardflow-demo/store.json','utf8')).patients.find(p=>p.lifecycle==='active')?.id;
  assert(patientId,'An active demo patient is required');
  const patientUrl=`${base}/patients/${patientId}`;
  await page.goto(patientUrl);
  const panel=page.getByRole('region',{name:'Underlying diseases',exact:true});
  const toggle=panel.getByRole('button',{name:'U/D',exact:true});
  const note=panel.getByRole('textbox',{name:'Underlying diseases',includeHidden:true}); const status=panel.locator('[role=status]');
  const open=async()=>{if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await wait(()=>note.isEditable());};
  const saved=()=>wait(async()=>await status.textContent()==='บันทึกแล้ว');
  const persisted=()=>JSON.parse(fs.readFileSync('.wardflow-demo/store.json','utf8')).patients.find(p=>p.id===patientId).underlyingDisease;
  assert.equal(await toggle.getAttribute('aria-expanded'),'false'); assert.equal(await note.isVisible(),false);
  await open(); const original=persisted();
  await note.fill('U/D browser test\n  HT, CKD\nภาษาไทย'); await toggle.click();
  assert.equal(await note.isVisible(),false); await saved(); await open();
  assert.equal(await readNote(note),'U/D browser test\n  HT, CKD\nภาษาไทย');
  assert.equal(persisted(),await readNote(note));
  const boxes=await Promise.all([page.locator('.patient-operational-header').boundingBox(),panel.boundingBox(),page.locator('[aria-label="Patient safety alerts"]').boundingBox()]);
  assert(boxes[0].y+boxes[0].height<=boxes[1].y); assert(boxes[1].y+boxes[1].height<=boxes[2].y);
  await page.reload(); assert.equal(await note.isVisible(),false); await open();
  assert.equal(await readNote(note),'U/D browser test\n  HT, CKD\nภาษาไทย');
  console.log('PASS default hidden, correct placement, fold preserves draft, autosave and reload persist multiline Thai text');

  await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
  await note.fill('U/D offline draft'); await wait(async()=>(await status.textContent()).includes('ไม่สำเร็จ'));
  await page.reload(); await open(); assert.equal(await readNote(note),'U/D offline draft');
  await page.unroute('**/*'); await saved(); assert.equal(persisted(),'U/D offline draft');
  console.log('PASS failed save keeps browser draft across reload and retries successfully');

  const other=await context.newPage();other.on('dialog',d=>d.accept());
  await other.goto(page.url()); const otherPanel=other.getByRole('region',{name:'Underlying diseases',exact:true});
  await otherPanel.getByRole('button',{name:'U/D',exact:true}).click(); const otherNote=otherPanel.getByRole('textbox',{name:'Underlying diseases'}); await wait(()=>otherNote.isEditable());
  // Keep both editors dirty before either can accept refreshed server props.
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await other.route('**/*',async route=>{if(route.request().method()==='POST'){await gate;}await route.continue();});
  await otherNote.fill('U/D stale second window');
  await note.fill('U/D first window wins'); await saved(); release();
  await wait(async()=>(await otherPanel.locator('[role=status]').textContent()).includes('อีกหน้าต่าง'));
  assert.equal(persisted(),'U/D first window wins'); assert.equal(await readNote(otherNote),'U/D stale second window');
  await other.close(); console.log('PASS concurrent editor conflict retains local draft without overwriting persisted text');

  await note.fill('U/D final summary\nHT\nCKD');await saved();
  await page.goto(`${patientUrl}/summary-note`);
  await page.locator('article').getByText(/Relevant underlying diseases: U\/D final summary/).waitFor();
  const summary=await page.locator('body').innerText();assert(summary.includes('U/D final summary'));assert(summary.includes('CKD'));
  await page.goto(patientUrl);await open();
  await note.fill('U/D heading'); await panel.getByRole('button',{name:'Heading',exact:true}).click();
  assert.equal(await note.locator('h3').innerText(),'U/D heading');
  await page.keyboard.press('End');await page.keyboard.press('Enter');
  await panel.getByRole('button',{name:'Body',exact:true}).click();await page.keyboard.insertText('U/D body');
  const increase=panel.getByRole('button',{name:'เพิ่มระยะเยื้อง'}), decrease=panel.getByRole('button',{name:'ลดระยะเยื้อง'});
  await increase.click();await increase.click();await decrease.click();
  assert.equal(await note.locator('p').filter({hasText:'U/D body'}).getAttribute('data-indent'),'1');
  await page.keyboard.press('End');await page.keyboard.press('Enter');await decrease.click();
  await page.keyboard.insertText('CKD');await panel.getByRole('button',{name:'Bullet list',exact:true}).click();
  await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.insertText('Stage 3');await increase.click();await saved();
  assert.equal(await note.locator('ul ul li').innerText(),'Stage 3');
  assert(persisted().startsWith('wardflow-note:v2:'));
  await toggle.click();await open();assert.equal(await note.locator('ul ul li').innerText(),'Stage 3');
  await page.reload();await open();assert.equal(await note.locator('h3').innerText(),'U/D heading');
  assert.equal(await note.locator('p').filter({hasText:'U/D body'}).getAttribute('data-indent'),'1');
  assert.equal(await note.locator('ul ul li').innerText(),'Stage 3');
  await note.locator('ul ul li p').click();await page.keyboard.press('End');await page.keyboard.insertText(' changed');
  await page.keyboard.press('Control+z');await saved();assert.equal(await note.locator('ul ul li').innerText(),'Stage 3');
  await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
  await note.locator('ul ul li p').click();await page.keyboard.press('End');await page.keyboard.insertText(' offline');
  await page.reload();await open();assert.equal(await note.locator('ul ul li').innerText(),'Stage 3 offline');
  await page.unroute('**/*');await saved();
  for(const width of [320,375,414,768]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert(await increase.isVisible());
  }
  await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'.codex/ud-rich-mobile.png'});
  await page.goto(`${patientUrl}/summary-note`);
  const preview=page.getByLabel('Summary note preview');await preview.getByText(/Relevant underlying diseases: U\/D heading/).waitFor();
  const richSummary=await preview.innerText();assert(richSummary.includes('  • Stage 3 offline'));assert(!richSummary.includes('wardflow-note:'));
  await page.goto(patientUrl);await open();
  const details=page.locator('details').filter({has:page.locator('summary').getByText('Patient details',{exact:false})}).first();
  await details.locator(':scope > summary').click();assert.equal(await details.locator('h3').innerText(),'U/D heading');
  assert.equal(await details.locator('ul ul li').innerText(),'Stage 3 offline');
  console.log('PASS shared Heading/Body/bullets/indent toolbar, undo, collapse/reload, rich offline recovery, Patient details, Summary Note and mobile');
  await note.click();await page.keyboard.press('Control+a');await page.keyboard.press('Backspace');
  await panel.getByRole('button',{name:'Body',exact:true}).click();
  await note.fill('');await saved();assert.equal(persisted(),null);
  await page.reload();await open();assert.equal(await readNote(note),'');
  console.log('PASS Summary Note uses current U/D; clearing persists and reloads empty');

  if(original?.startsWith('wardflow-note:')) {
   const store=JSON.parse(fs.readFileSync('.wardflow-demo/store.json','utf8'));
   store.patients.find(p=>p.id===patientId).underlyingDisease=original;
   fs.writeFileSync('.wardflow-demo/store.json',JSON.stringify(store,null,2));
   await page.reload();await open();
  } else if(original) { await note.fill(original);await saved(); }
  for(const width of [320,375,414,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const expanded of [false,true]){
    if((await toggle.getAttribute('aria-expanded')==='true')!==expanded)await toggle.click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`horizontal overflow at ${width}`);
    await page.screenshot({path:`.codex/ud-${width}-${expanded?'open':'closed'}.png`,fullPage:true});
   }
  }
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS responsive at 320/375/414/768/1440, no runtime errors; original demo U/D restored');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
