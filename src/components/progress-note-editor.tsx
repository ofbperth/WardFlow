"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import HardBreak from "@tiptap/extension-hard-break";
import { Extension, type Editor } from "@tiptap/core";
import { BulletList, ListItem } from "@tiptap/extension-list";
import { List, IndentDecrease, IndentIncrease } from "lucide-react";
import { UndoRedo } from "@tiptap/extensions";
import { parseProgressNote, serializeProgressNote, type NoteBlock } from "@/lib/progress-format";
import { ProgressNoteContent } from "@/components/progress-note-content";

function nodeFor(block: NoteBlock): JSONContent {
  if ("children" in block) return { type: block.type, content: block.children.map(nodeFor) };
  return {
    type: block.type, attrs: { ...(block.type === "heading" ? { level: 3 } : {}), indent: block.indent ?? 0 },
    content: block.text.split("\n").flatMap((line, index) => [
      ...(index ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : []),
    ]),
  };
}
function documentFor(value: string): JSONContent {
  return { type: "doc", content: parseProgressNote(value).map(nodeFor) };
}
function textFor(node: JSONContent): string {
  return node.type === "hardBreak" ? "\n" : node.text ?? (node.content ?? []).map(textFor).join("");
}
function blockFor(node: JSONContent): NoteBlock {
  if (node.type === "bulletList" || node.type === "listItem") return { type: node.type, children: (node.content ?? []).map(blockFor) };
  const indent = Math.min(6, Math.max(0, Number(node.attrs?.indent) || 0));
  return { type: node.type === "heading" ? "heading" : "paragraph", text: textFor(node), ...(indent ? { indent } : {}) };
}
function serializeDocument(doc: JSONContent) {
  return serializeProgressNote((doc.content ?? []).map(blockFor));
}
function changeIndent(editor: Editor, direction: -1 | 1, apply = true): boolean {
  if (editor.isActive("listItem")) {
    let depth = 0;
    for (let i = 0; i <= editor.state.selection.$from.depth; i++) {
      if (editor.state.selection.$from.node(i).type.name === "listItem") depth++;
    }
    if (direction > 0 && depth >= 7) return false;
    const chain = apply ? editor.chain().focus() : editor.can().chain();
    return direction > 0 ? chain.sinkListItem("listItem").run() : chain.liftListItem("listItem").run();
  }
  const { state } = editor;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return;
    const current = Number(node.attrs.indent) || 0;
    const indent = Math.min(6, Math.max(0, current + direction));
    if (indent !== current) { changed = true; tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent }); }
  });
  if (changed && apply) { editor.view.dispatch(tr); editor.commands.focus(); }
  return changed;
}
const Indent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [{ types: ["paragraph", "heading"], attributes: { indent: {
      default: 0,
      parseHTML: element => Math.min(6, Math.max(0, Number(element.getAttribute("data-indent")) || 0)),
      renderHTML: attributes => attributes.indent ? { "data-indent": attributes.indent, style: `margin-inline-start: ${attributes.indent * 1.25}rem` } : {},
    } } }];
  },
});
const IndentedListItem = ListItem.extend({
  addKeyboardShortcuts() {
    return { ...this.parent?.(), Tab: () => changeIndent(this.editor, 1), "Shift-Tab": () => changeIndent(this.editor, -1) };
  },
});
function setTextBlock(editor: Editor, heading: boolean) {
  // Lift only the selected list item; keep neighboring items and their nesting intact.
  while (editor.isActive("listItem")) {
    if (!editor.chain().focus().liftListItem("listItem").run()) break;
  }
  if (heading) editor.chain().focus().setHeading({ level: 3 }).run();
  else editor.chain().focus().setParagraph().run();
}
const extensions = [Document, Paragraph, Text, Heading.configure({ levels: [3] }), HardBreak, UndoRedo, BulletList, IndentedListItem, Indent];

export function ProgressNoteEditor({ id, value, onChange, readOnly = false, onBlur, onCompositionStart, onCompositionEnd, autoSave = true, ariaLabel = "Progress note", ariaDescribedBy }: {
  autoSave?: boolean; id?: string; value: string; onChange: (value: string) => void; readOnly?: boolean;
  onBlur?: () => void; onCompositionStart?: () => void; onCompositionEnd?: () => void;
  ariaLabel?: string; ariaDescribedBy?: string;
}) {
  const editor = useEditor({
    extensions, enableInputRules: false, immediatelyRender: false, content: documentFor(value), editable: !readOnly,
    editorProps: { attributes: {
      id: id ?? "", role: "textbox", "aria-label": ariaLabel, "aria-multiline": "true",
      ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
      class: "progress-note-input min-h-36 whitespace-pre-wrap break-words px-3 py-3 text-sm leading-7 outline-none [&_h3]:text-lg [&_h3]:font-bold [&_h3]:leading-8 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle]",
    } },
    onUpdate: ({ editor }) => onChange(serializeDocument(editor.getJSON())),
  });
  const format = useEditorState({ editor, selector: ({ editor }) => ({
    heading: editor?.isActive("heading") ?? false,
    bullet: editor?.isActive("bulletList") ?? false,
    decrease: editor ? changeIndent(editor, -1, false) : false,
    increase: editor ? changeIndent(editor, 1, false) : false,
  }) });
  const heading = format?.heading ?? false;
  // Enabling input is not a document edit: emitting an update here can overwrite
  // a recovered draft with the editor's initial server content before setContent.
  useEffect(() => { editor?.setEditable(!readOnly, false); }, [editor, readOnly]);
  useEffect(() => {
    if (editor && serializeDocument(editor.getJSON()) !== serializeDocument(documentFor(value))) {
      editor.commands.setContent(documentFor(value), { emitUpdate: false });
    }
  }, [editor, value]);
  return <div className="overflow-hidden rounded-xl border clinical-divider bg-white focus-within:border-[color:var(--color-accent)] focus-within:ring-1 focus-within:ring-[color:var(--color-accent)]">
    <div onBlur={onBlur} onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd}>
      {editor ? <EditorContent editor={editor} /> : <div className="min-h-36 p-3"><ProgressNoteContent value={value} /></div>}
    </div>
    {!readOnly ? <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
      <span className="text-xs text-muted">{autoSave ? "Auto save" : "กด Save progress note เพื่อบันทึก"}</span>
      <div role="group" aria-label="รูปแบบข้อความ" className="ml-auto flex max-w-full flex-wrap rounded-xl border clinical-divider p-0.5">
        <button type="button" title="Heading" aria-label="Heading" aria-pressed={heading ?? false} disabled={!editor}
          onMouseDown={event => event.preventDefault()}
          onClick={() => editor && setTextBlock(editor, true)}
          className={`h-11 w-11 rounded-lg ${heading ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]" : "text-foreground"}`}><span className="text-xl font-bold">H</span></button>
        <button type="button" title="Body" aria-label="Body" aria-pressed={!heading && !format?.bullet} disabled={!editor}
          onMouseDown={event => event.preventDefault()}
          onClick={() => editor && setTextBlock(editor, false)}
          className={`h-11 w-11 rounded-lg ${!heading && !format?.bullet ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]" : "text-foreground"}`}><span className="text-xs font-medium">Text</span></button>
        <span aria-hidden="true" className="mx-1 my-2 border-l clinical-divider" />
        <button type="button" title="Bullet list" aria-label="Bullet list" aria-pressed={format?.bullet ?? false} disabled={!editor}
          onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`flex h-11 w-11 items-center justify-center rounded-lg ${format?.bullet ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]" : "text-foreground"}`}><List aria-hidden="true" className="h-5 w-5" /></button>
        <span aria-hidden="true" className="mx-1 my-2 border-l clinical-divider" />
        <button type="button" title="ลดระยะเยื้อง" aria-label="ลดระยะเยื้อง" disabled={!format?.decrease}
          onMouseDown={event => event.preventDefault()} onClick={() => editor && changeIndent(editor, -1)}
          className="flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-[color:var(--color-accent-soft)]"><IndentDecrease aria-hidden="true" className="h-5 w-5" /></button>
        <button type="button" title="เพิ่มระยะเยื้อง" aria-label="เพิ่มระยะเยื้อง" disabled={!format?.increase}
          onMouseDown={event => event.preventDefault()} onClick={() => editor && changeIndent(editor, 1)}
          className="flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-[color:var(--color-accent-soft)]"><IndentIncrease aria-hidden="true" className="h-5 w-5" /></button>
      </div>
    </div> : null}
  </div>;
}

export function ProgressNoteHistoryField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <><input type="hidden" name="note" value={value} /><ProgressNoteEditor value={value} onChange={setValue} autoSave={false} /></>;
}
