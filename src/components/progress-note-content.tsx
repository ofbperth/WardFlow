import { parseProgressNote, type NoteBlock } from "@/lib/progress-format";

function Blocks({ blocks }: { blocks: NoteBlock[] }) {
  return blocks.map((block, index) => {
    if (block.type === "bulletList") return <ul key={index} className="list-disc pl-5"><Blocks blocks={block.children} /></ul>;
    if (block.type === "listItem") return <li key={index}><Blocks blocks={block.children} /></li>;
    const style = { marginInlineStart: `${(block.indent ?? 0) * 1.25}rem` };
    return block.type === "heading"
      ? <h3 key={index} style={style} className="text-lg font-bold leading-8">{block.text || <br />}</h3>
      : <p key={index} style={style}>{block.text || <br />}</p>;
  });
}

export function ProgressNoteContent({ value }: { value: string }) {
  return <div className="whitespace-pre-wrap break-words text-sm leading-7"><Blocks blocks={parseProgressNote(value)} /></div>;
}
