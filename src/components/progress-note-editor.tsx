"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import HardBreak from "@tiptap/extension-hard-break";
import { UndoRedo } from "@tiptap/extensions";
import { parseProgressNote, serializeProgressNote } from "@/lib/progress-format";
import { ProgressNoteContent } from "@/components/progress-note-content";

function documentFor(value: string): JSONContent {
  return { type: "doc", content: parseProgressNote(value).map(block => ({
    type: block.type, ...(block.type === "heading" ? { attrs: { level: 3 } } : {}),
    content: block.text.split("\n").flatMap((line, index) => [
      ...(index ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : []),
    ]),
  })) };
}
function textFor(node: JSONContent): string {
  return node.type === "hardBreak" ? "\n" : node.text ?? (node.content ?? []).map(textFor).join("");
}
function serializeDocument(doc: JSONContent) {
  return serializeProgressNote((doc.content ?? []).map(node => ({
    type: node.type === "heading" ? "heading" : "paragraph", text: textFor(node),
  })));
}
const extensions = [Document, Paragraph, Text, Heading.configure({ levels: [3] }), HardBreak, UndoRedo];

export function ProgressNoteEditor({ id, value, onChange, readOnly = false, onBlur, onCompositionStart, onCompositionEnd, autoSave = true }: {
  autoSave?: boolean; id?: string; value: string; onChange: (value: string) => void; readOnly?: boolean;
  onBlur?: () => void; onCompositionStart?: () => void; onCompositionEnd?: () => void;
}) {
  const editor = useEditor({
    extensions, enableInputRules: false, immediatelyRender: false, content: documentFor(value), editable: !readOnly,
    editorProps: { attributes: {
      id: id ?? "", role: "textbox", "aria-label": "Progress note", "aria-multiline": "true",
      class: "progress-note-input min-h-36 whitespace-pre-wrap break-words px-3 py-3 text-sm leading-7 outline-none [&_h3]:text-lg [&_h3]:font-bold [&_h3]:leading-8",
    } },
    onUpdate: ({ editor }) => onChange(serializeDocument(editor.getJSON())),
  });
  const heading = useEditorState({ editor, selector: ({ editor }) => editor?.isActive("heading") ?? false });
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
      <div role="group" aria-label="รูปแบบข้อความ" className="ml-auto flex rounded-full border clinical-divider p-0.5">
        <button type="button" title="Heading" aria-label="Heading" aria-pressed={heading ?? false} disabled={!editor}
          onMouseDown={event => event.preventDefault()}
          onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()}
          className={`h-10 w-11 rounded-full ${heading ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]" : "text-foreground"}`}><span className="text-xl font-bold">H</span></button>
        <button type="button" title="Body" aria-label="Body" aria-pressed={!heading} disabled={!editor}
          onMouseDown={event => event.preventDefault()}
          onClick={() => editor?.chain().focus().setParagraph().run()}
          className={`h-10 w-11 rounded-full ${!heading ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]" : "text-foreground"}`}><span className="text-xs font-medium">Text</span></button>
      </div>
    </div> : null}
  </div>;
}

export function ProgressNoteHistoryField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <><input type="hidden" name="note" value={value} /><ProgressNoteEditor value={value} onChange={setValue} autoSave={false} /></>;
}
