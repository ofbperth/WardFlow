// Versioned text envelope keeps existing note columns and autosave conflict checks intact.
// Legacy plain text is never interpreted as HTML or Markdown.
const PREFIX = "wardflow-note:v1:";
export type NoteBlock = { type: "paragraph" | "heading"; text: string };

export function parseProgressNote(value: string): NoteBlock[] {
  if (value.startsWith(PREFIX)) {
    try {
      const blocks: unknown = JSON.parse(value.slice(PREFIX.length));
      if (Array.isArray(blocks) && blocks.length && blocks.every(block => block &&
        (block.type === "paragraph" || block.type === "heading") && typeof block.text === "string")) {
        return blocks.map(({ type, text }) => ({ type, text }));
      }
    } catch { /* Malformed/legacy content remains visible as literal text. */ }
  }
  return value.split("\n").map(text => ({ type: "paragraph", text }));
}

export function serializeProgressNote(blocks: NoteBlock[]): string {
  const text = blocks.map(block => block.text).join("\n");
  if (!text) return "";
  return blocks.some(block => block.type === "heading") || text.startsWith(PREFIX)
    ? PREFIX + JSON.stringify(blocks) : text;
}

export function progressNoteText(value: string | null | undefined): string {
  return parseProgressNote(value ?? "").map(block => block.text).join("\n");
}
