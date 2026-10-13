/**
 * extract-blocks：carrier 口径 id + 历史 textContent（KaTeX）legacyId 回退。
 */
import { describe, expect, it } from "vitest";
import { computeBlockId } from "../block-id";
import {
	extractCandidateBlocks,
	findBlockElement,
	getBlockText,
	getLegacyBlockText,
} from "../extract-blocks";
import { relocate } from "../relocate";
import type { Anchor } from "../types";

function mathParagraph(): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = `
		<p>质能方程 <span data-type="inline-math" data-latex="E=mc^2"><span class="katex">E=mc2E=mc^2E=mc2</span></span> 成立</p>
	`;
	document.body.append(root);
	return root;
}

describe("getBlockText carrier vs legacy textContent", () => {
	it("inline-math 用 data-latex，不含 KaTeX 渲染重复文本", () => {
		const root = mathParagraph();
		const p = root.querySelector("p")!;
		expect(getBlockText(p)).toBe("质能方程 E=mc^2 成立");
		expect(getLegacyBlockText(p)).toContain("E=mc2");
		expect(getLegacyBlockText(p)).not.toBe(getBlockText(p));
		root.remove();
	});
});

describe("findBlockElement / extractCandidateBlocks legacy fallback", () => {
	it("现行 carrier hash 与 legacy textContent hash 均可定位同一块", async () => {
		const root = mathParagraph();
		const p = root.querySelector("p")!;
		const canonical = getBlockText(p);
		const legacy = getLegacyBlockText(p);
		const newId = await computeBlockId(canonical);
		const oldId = await computeBlockId(legacy);
		expect(newId).not.toBeNull();
		expect(oldId).not.toBeNull();
		expect(newId).not.toBe(oldId);

		expect(await findBlockElement(root, newId!)).toBe(p);
		expect(await findBlockElement(root, oldId!)).toBe(p);

		const blocks = await extractCandidateBlocks(root);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.id).toBe(newId);
		expect(blocks[0]?.legacyId).toBe(oldId);
		root.remove();
	});

	it("无公式段落不产生 legacyId", async () => {
		const root = document.createElement("div");
		root.innerHTML = "<p>hello world</p>";
		document.body.append(root);
		const blocks = await extractCandidateBlocks(root);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.legacyId).toBeUndefined();
		expect(await findBlockElement(root, blocks[0]!.id)).toBe(root.querySelector("p"));
		root.remove();
	});
});

describe("relocate legacyId hash 快路径", () => {
	it("anchor.blockTextHash 为旧 textContent hash → located，用 selectedText 落在 carrier 文本", async () => {
		const root = mathParagraph();
		const blocks = await extractCandidateBlocks(root);
		const block = blocks[0]!;
		expect(block.legacyId).toBeTruthy();

		const anchor: Anchor = {
			blockId: block.legacyId!,
			blockTextHash: block.legacyId!,
			startOffset: 0,
			endOffset: 3,
			selectedText: "质能方程",
		};
		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		expect(result.blockId).toBe(block.id);
		expect(result.selectedText).toBe("质能方程");
		expect(result.startOffset).toBe(0);
		expect(result.fuzzy).toBe(false);
		root.remove();
	});
});
