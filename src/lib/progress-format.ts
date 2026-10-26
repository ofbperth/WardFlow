// Versioned envelopes preserve legacy notes and the existing autosave contract.
const PREFIX = "wardflow-note:v1:";
const RICH_PREFIX = "wardflow-note:v2:";
export type NoteBlock = { type: "paragraph" | "heading"; text: string; indent?: number }
  | { type: "bulletList"; children: NoteBlock[] }
  | { type: "listItem"; children: NoteBlock[] };

function validBlocks(value: unknown, depth = 0): value is NoteBlock[] {
  if (!Array.isArray(value) || !value.length || depth > 32) return false;
  return value.every(block => {
    if (!block || typeof block !== "object") return false;
    if (block.type === "paragraph" || block.type === "heading") {
      return typeof block.text === "string" && (block.indent === undefined ||
        (Number.isInteger(block.indent) && block.indent >= 0 && block.indent <= 6));
    }
    if (block.type !== "bulletList" && block.type !== "listItem") return false;
    return validBlocks(block.children, depth + 1) && (block.type === "bulletList"
      ? block.children.every((child: NoteBlock) => child.type === "listItem")
      : block.children[0].type === "paragraph" && block.children.every((child: NoteBlock) => child.type !== "listItem"));
  });
}

export function parseProgressNote(value: string): NoteBlock[] {
  const prefix = value.startsWith(RICH_PREFIX) ? RICH_PREFIX : PREFIX;
  if (value.startsWith(prefix)) {
    try {
      const blocks: unknown = JSON.parse(value.slice(prefix.length));
      if (validBlocks(blocks) && blocks.every(block => block.type !== "listItem")) return blocks;
    } catch { /* Malformed content remains visible as literal text. */ }
  }
  return value.split("\n").map(text => ({ type: "paragraph", text }));
}

export function noteBlocksText(blocks: NoteBlock[], depth = 0): string {
  return blocks.map(block => {
    if (block.type === "bulletList") return block.children.map(item => {
      if (!("children" in item)) return "";
      return item.children.map((child, index) => child.type === "bulletList"
        ? noteBlocksText([child], depth + 1)
        : `${"  ".repeat(depth)}${index === 0 ? "• " : "  "}${noteBlocksText([child])}`).join("\n");
    }).join("\n");
    if (block.type === "listItem") return noteBlocksText(block.children, depth);
    return block.text.split("\n").map(line => "  ".repeat(block.indent ?? 0) + line).join("\n");
  }).join("\n");
}

export function serializeProgressNote(blocks: NoteBlock[]): string {
  const hasContent = (items: NoteBlock[]): boolean => items.some(block => "text" in block ? Boolean(block.text) : hasContent(block.children));
  if (!hasContent(blocks)) return "";
  const rich = blocks.some(block => block.type === "bulletList" || block.type === "listItem" || Boolean(block.indent));
  if (rich) return RICH_PREFIX + JSON.stringify(blocks);
  const text = noteBlocksText(blocks);
  return blocks.some(block => block.type === "heading") || text.startsWith(PREFIX) || text.startsWith(RICH_PREFIX)
    ? PREFIX + JSON.stringify(blocks) : text;
}

export function progressNoteText(value: string | null | undefined): string {
  return noteBlocksText(parseProgressNote(value ?? ""));
}
