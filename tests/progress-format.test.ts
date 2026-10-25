import assert from "node:assert/strict";
import test from "node:test";
import { parseProgressNote, progressNoteText, serializeProgressNote } from "../src/lib/progress-format.js";

test("legacy notes retain literal HTML, markdown, Thai, whitespace and empty lines", () => {
  const text = "# Heading?\n<script>alert(1)</script>\nภาษาไทย  \n\n";
  assert.equal(serializeProgressNote(parseProgressNote(text)), text);
  assert(parseProgressNote(text).every(block => block.type === "paragraph"));
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
