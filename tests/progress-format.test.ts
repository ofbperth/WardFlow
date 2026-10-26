import assert from "node:assert/strict";
import test from "node:test";
import { parseProgressNote, progressNoteText, serializeProgressNote, type NoteBlock } from "../src/lib/progress-format.js";

test("legacy notes retain literal HTML, markdown, Thai, whitespace and empty lines", () => {
  const text = "# Heading?\n<script>alert(1)</script>\nภาษาไทย  \n\n";
  assert.equal(serializeProgressNote(parseProgressNote(text)), text);
  assert(parseProgressNote(text).every(block => block.type === "paragraph"));
});

test("nested bullets and paragraph indents survive storage and text export", () => {
  const blocks: NoteBlock[] = [
    { type: "paragraph", text: "ย่อหน้า", indent: 2 },
    { type: "bulletList", children: [{ type: "listItem", children: [
      { type: "paragraph", text: "หลัก" },
      { type: "bulletList", children: [{ type: "listItem", children: [{ type: "paragraph", text: "ย่อย" }] }] },
    ] }] },
  ];
  const encoded = serializeProgressNote(blocks);
  assert(encoded.startsWith("wardflow-note:v2:"));
  assert.deepEqual(parseProgressNote(encoded), blocks);
  assert.equal(progressNoteText(encoded), "    ย่อหน้า\n• หลัก\n  • ย่อย");
  const literal = "wardflow-note:v2:not JSON";
  assert.equal(progressNoteText(serializeProgressNote([{ type: "paragraph", text: literal }])), literal);
});

test("invalid rich nodes and indentation remain literal instead of dropping text", () => {
  for (const value of [
    'wardflow-note:v2:[{"type":"paragraph","text":"keep","indent":100}]',
    'wardflow-note:v2:[{"type":"bulletList","children":[{"type":"paragraph","text":"keep"}]}]',
  ]) assert.equal(progressNoteText(value), value);
});
test("heading and body survive serialization and exports get only text", () => {
  const blocks = [{ type: "heading" as const, text: "หัวข้อ" }, { type: "paragraph" as const, text: "ข้อความ\nบรรทัดต่อไป" }];
  assert.deepEqual(parseProgressNote(serializeProgressNote(blocks)), blocks);
  assert.equal(progressNoteText(serializeProgressNote(blocks)), "หัวข้อ\nข้อความ\nบรรทัดต่อไป");
});
test("malformed envelopes stay visible, empty content clears and prefix text can be escaped", () => {
  const text = "wardflow-note:v1:not JSON";
  assert.equal(progressNoteText(text), text);
  assert.equal(progressNoteText(serializeProgressNote([{ type: "paragraph", text }])), text);
  assert.equal(serializeProgressNote([{ type: "paragraph", text: "" }]), "");
  assert.equal(serializeProgressNote([{ type: "heading", text: "" }]), "");
});
