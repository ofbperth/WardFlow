import { parseProgressNote } from "@/lib/progress-format";

export function ProgressNoteContent({ value }: { value: string }) {
  return <div className="whitespace-pre-wrap break-words text-sm leading-7">
    {parseProgressNote(value).map((block, index) => block.type === "heading"
      ? <h3 key={index} className="text-lg font-bold leading-8">{block.text || <br />}</h3>
      : <p key={index}>{block.text || <br />}</p>)}
  </div>;
}
