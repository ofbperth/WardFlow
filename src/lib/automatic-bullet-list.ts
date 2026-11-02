import { wrappingInputRule } from "@tiptap/core";
import { BulletList } from "@tiptap/extension-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { canJoin, findWrapping, Mapping } from "@tiptap/pm/transform";

const normalizationKey = new PluginKey("automaticBulletNormalization");
const marker = /^[ \t\u00a0]*[•-][ \t\u00a0]+/;

export const AutomaticBulletList = BulletList.extend({
  addProseMirrorPlugins() {
    const listType = this.type;
    return [new Plugin({
      key: normalizationKey,
      appendTransaction(transactions, oldState, state) {
        // Hydration and history must restore exactly the stored document. A
        // formatting-only edit (e.g. lifting a list) must not trigger conversion.
        if (!transactions.some(tr => tr.docChanged) || transactions.some(tr =>
          tr.getMeta(normalizationKey) || tr.getMeta("preventUpdate") || isHistoryTransaction(tr))) return null;
        const mapping = new Mapping();
        transactions.forEach(tr => mapping.appendMapping(tr.mapping));
        const inverse = mapping.invert();
        const candidates: { from: number; to: number; breaks: { from: number; to: number }[] }[] = [];
        state.doc.descendants((node, pos) => {
          // Already-structured lists retain their existing nesting and markers.
          if (node.type.name === "listItem") return false;
          if (node.type.name !== "paragraph") return;
          const oldPos = inverse.map(pos);
          const oldNode = oldState.doc.nodeAt(oldPos);
          if (oldNode?.type === node.type && oldNode.content.eq(node.content)) return;
          const text = node.textBetween(0, node.content.size, "", "\n");
          if (!text.split(/\r\n|\r|\n/).some(line => marker.test(line))) return;
          const breaks: { from: number; to: number }[] = [];
          node.forEach((child, offset) => {
            if (child.type.name === "hardBreak") breaks.push({ from: pos + 1 + offset, to: pos + 2 + offset });
            if (child.isText) {
              for (const match of child.text!.matchAll(/\r\n|\r|\n/g)) {
                const from = pos + 1 + offset + match.index;
                breaks.push({ from, to: from + match[0].length });
              }
            }
          });
          candidates.push({ from: pos, to: pos + node.nodeSize, breaks });
        });
        const tr = state.tr;
        for (const candidate of candidates.reverse()) {
          // Split with steps rather than replacing the paragraph wholesale so
          // ProseMirror maps the caret, selection, and undo history correctly.
          for (const boundary of candidate.breaks.reverse()) {
            const from = tr.mapping.map(boundary.from);
            const to = tr.mapping.map(boundary.to);
            tr.delete(from, to).split(from);
          }
          const paragraphs: number[] = [];
          tr.doc.nodesBetween(tr.mapping.map(candidate.from), tr.mapping.map(candidate.to), (node, pos) => {
            if (node.type.name === "paragraph" && marker.test(node.textContent)) paragraphs.push(pos);
          });
          for (const pos of paragraphs.reverse()) {
            const node = tr.doc.nodeAt(pos)!;
            const prefix = marker.exec(node.textContent)![0];
            tr.delete(pos + 1, pos + 1 + prefix.length);
            const range = tr.doc.resolve(pos + 1).blockRange();
            const wrapping = range && findWrapping(range, listType);
            if (!range || !wrapping) continue;
            tr.wrap(range, wrapping);
            const end = pos + tr.doc.nodeAt(pos)!.nodeSize;
            if (tr.doc.resolve(end).nodeAfter?.type === listType && canJoin(tr.doc, end)) tr.join(end);
            if (tr.doc.resolve(pos).nodeBefore?.type === listType && canJoin(tr.doc, pos)) tr.join(pos);
          }
        }
        return tr.docChanged ? tr.setMeta(normalizationKey, true) : null;
      },
    })];
  },
  addInputRules() {
    return [wrappingInputRule({ find: /^[•-][ \t\u00a0]$/, type: this.type })];
  },
});
