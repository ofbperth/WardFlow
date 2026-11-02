/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { getSchema } = require('@tiptap/core');
const { EditorState, TextSelection } = require('@tiptap/pm/state');
const { history, undo, redo } = require('@tiptap/pm/history');
const filename = path.resolve(__dirname, '../src/lib/automatic-bullet-list.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { AutomaticBulletList } = loaded.exports;
const schema = getSchema([
  require('@tiptap/extension-document').Document,
  require('@tiptap/extension-paragraph').Paragraph,
  require('@tiptap/extension-text').Text,
  require('@tiptap/extension-hard-break').HardBreak,
  require('@tiptap/extension-heading').Heading,
  require('@tiptap/extension-list').ListItem,
  AutomaticBulletList,
]);
const p = text => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const doc = (...nodes) => schema.nodes.doc.create(null, nodes);
function stateFor(document = doc(p())) {
  return EditorState.create({ schema, doc: document, plugins: [history(),
    ...(AutomaticBulletList.config.addProseMirrorPlugins?.call({ type: schema.nodes.bulletList }) ?? []),
  ] });
}
const items = state => {
  const result = [];
  state.doc.descendants(node => { if (node.type.name === 'listItem') result.push(node.textContent); });
  return result;
};
// Synthetic clinical text: no patient information is stored in the regression suite.
const lines = ['24/10/69 มีไข้ BT 38.0 C', 'due to organism pending identification', 'on treatment (30/9/69 - 20/10/69) ** follow up'];
const bulk = lines.map(line => `• ${line}`).join('\n');
test('whole-text insertion without a clipboard event creates real list items', () => {
  const before = stateFor();
  const after = before.applyTransaction(before.tr.insertText(bulk)).state;
  assert.deepEqual(items(after), lines);
  assert.equal(after.doc.childCount, 1);
  assert.equal(after.doc.firstChild.type.name, 'bulletList');
});
test('hard breaks, indented markers, NBSP, and ordinary paragraphs preserve text', () => {
  const before = stateFor();
  const paragraph = schema.nodes.paragraph.create(null, [
    schema.text('Intro'), schema.nodes.hardBreak.create(),
    schema.text('•\u00a0First'), schema.nodes.hardBreak.create(),
    schema.text('  • Second'), schema.nodes.hardBreak.create(),
    schema.text('Plain • inline'),
  ]);
  const after = before.applyTransaction(before.tr.replaceWith(0, before.doc.content.size, paragraph)).state;
  assert.deepEqual(items(after), ['First', 'Second']);
  assert.deepEqual(after.doc.content.content.map(node => node.type.name), ['paragraph', 'bulletList', 'paragraph']);
  assert.equal(after.doc.firstChild.textContent, 'Intro');
  assert.equal(after.doc.lastChild.textContent, 'Plain • inline');
});
test('separate paragraph insertion joins lists and preserves negative numbers and inline markers', () => {
  const before = stateFor();
  const after = before.applyTransaction(before.tr.replaceWith(0, before.doc.content.size,
    [p('• First'), p('- Second'), p('-5'), p('Text • stays inline')])).state;
  assert.deepEqual(items(after), ['First', 'Second']);
  assert.equal(after.doc.childCount, 3);
  assert.equal(after.doc.child(1).textContent, '-5');
});
test('caret stays at inserted text end; one undo/redo restores the whole insertion', () => {
  const before = stateFor();
  let state = before.applyTransaction(before.tr.insertText(bulk)).state;
  assert.equal(state.selection.$from.parent.textContent, lines[2]);
  assert.equal(state.selection.$from.parentOffset, lines[2].length);
  const dispatch = tr => { state = state.applyTransaction(tr).state; };
  assert(undo(state, dispatch));
  assert(state.doc.eq(before.doc));
  assert(redo(state, dispatch));
  assert.deepEqual(items(state), lines);
});
test('hydration, headings and unchanged paragraphs are not normalized', () => {
  let state = stateFor();
  state = state.applyTransaction(state.tr.replaceWith(0, state.doc.content.size,
    [p('• Legacy plain text'), p('Other')]).setMeta('preventUpdate', true)).state;
  assert.deepEqual(items(state), []);
  state = state.applyTransaction(state.tr.insertText(' edit', state.doc.content.size - 1)).state;
  assert.deepEqual(items(state), []);
  const heading = schema.nodes.heading.create({ level: 3 }, schema.text('• Heading'));
  state = state.applyTransaction(state.tr.replaceWith(0, state.doc.content.size, heading)).state;
  assert.equal(state.doc.firstChild.type.name, 'heading');
});
test('typing in a different block does not convert old literal markers, even after position shifts', () => {
  let state = stateFor(doc(p('First'), p('• Keep literal')));
  state = state.applyTransaction(state.tr.insertText(' more', 6)).state;
  assert.deepEqual(items(state), []);
  assert.equal(state.doc.lastChild.textContent, '• Keep literal');
});
test('mid-paragraph insertion preserves prefix and suffix and maps selection', () => {
  let state = stateFor(doc(p('Before After')));
  state = state.applyTransaction(state.tr.setSelection(TextSelection.create(state.doc, 8)).insertText('• inline\n• item\n')).state;
  assert.deepEqual(items(state), ['item']);
  assert.equal(state.doc.firstChild.textContent, 'Before • inline');
  assert.equal(state.doc.lastChild.textContent, 'After');
  assert.equal(state.selection.$from.parent.textContent, 'After');
  assert.equal(state.selection.$from.parentOffset, 0);
});
test('existing nested lists remain structured without duplicate wrapping', () => {
  const item = text => schema.nodes.listItem.create(null, p(text));
  const list = schema.nodes.bulletList.create(null, [item('Parent'),
    schema.nodes.listItem.create(null, [p('Child'), schema.nodes.bulletList.create(null, item('Nested'))])]);
  const before = stateFor();
  const after = before.applyTransaction(before.tr.replaceWith(0, before.doc.content.size, list)).state;
  assert(after.doc.eq(doc(list)));
});
