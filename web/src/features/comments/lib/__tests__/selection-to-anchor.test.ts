/**
 * selectionToAnchor 测试：覆盖「特殊块（代码块/图块/块级公式）选中时不可批注」。
 *
 * 现实里这些块语义上不可批注：
 * - 代码块 pre：shiki 输出 pre.shiki、降级 pre、图块错误态源码 pre 都命中
 * - 图块 div[data-type=diagram-block]：渲染产物是 SVG，不可批注
 * - 块级公式：KaTeX display 产物 .katex-display，不可批注
 *
 * 通过 isSelectionInUnannotatableContainer 在 selectionToAnchor 入口拦截。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildBlockAnchor } from "../block-anchor";
import { computeBlockId } from "../block-id";
import { extractCandidateBlocks, findBlockElement } from "../extract-blocks";
import {
	closestAnnotatableBlock,
	isSelectionInUnannotatableContainer,
	selectionCapability,
	selectionToAnchor,
} from "../selection-to-anchor";

/** 在 root 内构造 DOM 并模拟选中 [startNode, startOff] → [endNode, endOff]。 */
function selectRange(startNode: Node, startOff: number, endNode: Node, endOff: number) {
	const sel = window.getSelection();
	sel?.removeAllRanges();
	const range = document.createRange();
	range.setStart(startNode, startOff);
	range.setEnd(endNode, endOff);
	sel?.addRange(range);
}

/** 当前选区的 Range（供 isSelectionInUnannotatableContainer 用）。 */
function currentRange(): Range {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) throw new Error("no selection");
	return sel.getRangeAt(0);
}

/** getElementById 的非空封装（测试内 DOM 是固定模板，元素一定存在）。 */
function byId(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`element #${id} not found`);
	return el;
}

/** 取元素的第一个子节点（文本节点），非空封装。 */
function firstChild(el: HTMLElement): Node {
	const node = el.firstChild;
	if (!node) throw new Error(`element has no child: ${el.id}`);
	return node;
}

/** 构造正文容器，模拟阅读端真实 DOM 结构（CodeCard 外层有 div 包装）。 */
function buildRoot(): HTMLElement {
	const root = document.createElement("main");
	root.setAttribute("data-article-content", "");
	root.innerHTML = `
    <p id="p-text">这是普通段落，可以被批注。</p>
    <!-- CodeCard：外层 div 包装（含语言标签/复制按钮），内部 shiki 输出 pre>code -->
    <div class="group relative">
      <div class="shiki-code">
        <pre class="shiki"><code id="code-text">const x = 1;</code></pre>
      </div>
    </div>
    <div data-type="diagram-block" data-source="graph TD; A-->B">
      <div class="diagram-render">
        <svg><text id="diagram-text">Node A</text></svg>
      </div>
    </div>
    <div class="my-6 overflow-x-auto">
      <span class="katex-display"><span class="katex"><span id="math-text">a²+b²</span></span></span>
    </div>
    <p>另一个普通段落 <span class="katex"><span id="inline-math-text">x²</span></span> 结束。</p>
    `;
	document.body.appendChild(root);
	return root;
}

describe("selectionToAnchor", () => {
	let root: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = "";
		root = buildRoot();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("普通段落 → 返回 Anchor（对照基线）", async () => {
		const p = byId("p-text");
		const textNode = firstChild(p);
		selectRange(textNode, 2, textNode, 4);

		const anchor = await selectionToAnchor({ root });
		expect(anchor).not.toBeNull();
	});

	it("代码块 pre（CodeCard 内 shiki pre>code）→ 返回 null（不可批注）", async () => {
		const code = byId("code-text");
		const textNode = firstChild(code);
		selectRange(textNode, 0, textNode, 4);

		const anchor = await selectionToAnchor({ root });
		expect(anchor).toBeNull();
	});

	it("图块 div[data-type=diagram-block] 内 SVG 文本 → 返回 null", async () => {
		const text = byId("diagram-text");
		const textNode = firstChild(text);
		selectRange(textNode, 0, textNode, 3);

		const anchor = await selectionToAnchor({ root });
		expect(anchor).toBeNull();
	});

	it("块级公式 .katex-display 内文本 → 返回 null", async () => {
		const math = byId("math-text");
		const textNode = firstChild(math);
		selectRange(textNode, 0, textNode, 3);

		const anchor = await selectionToAnchor({ root });
		expect(anchor).toBeNull();
	});

	it("行内公式（段落内 .katex，非 .katex-display）→ 仍可批注（段落文字流）", async () => {
		const inline = byId("inline-math-text");
		const textNode = firstChild(inline);
		// 选中行内公式内文本——它在 <p> 内，应命中 p 返回 Anchor
		selectRange(textNode, 0, textNode, 1);

		const anchor = await selectionToAnchor({ root });
		expect(anchor).not.toBeNull();
	});
});

describe("isSelectionInUnannotatableContainer", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		buildRoot();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("普通段落内选区 → false", () => {
		const p = byId("p-text");
		selectRange(firstChild(p), 0, firstChild(p), 2);
		expect(isSelectionInUnannotatableContainer(currentRange())).toBe(false);
	});

	it("代码块 pre 内选区 → true", () => {
		const code = byId("code-text");
		selectRange(firstChild(code), 0, firstChild(code), 4);
		expect(isSelectionInUnannotatableContainer(currentRange())).toBe(true);
	});

	it("图块 diagram-block 内选区 → true", () => {
		const text = byId("diagram-text");
		selectRange(firstChild(text), 0, firstChild(text), 3);
		expect(isSelectionInUnannotatableContainer(currentRange())).toBe(true);
	});

	it("块级公式 .katex-display 内选区 → true", () => {
		const math = byId("math-text");
		selectRange(firstChild(math), 0, firstChild(math), 3);
		expect(isSelectionInUnannotatableContainer(currentRange())).toBe(true);
	});

	it("行内公式（.katex 非 display）内选区 → false", () => {
		const inline = byId("inline-math-text");
		selectRange(firstChild(inline), 0, firstChild(inline), 1);
		expect(isSelectionInUnannotatableContainer(currentRange())).toBe(false);
	});
});

describe("closestAnnotatableBlock", () => {
	it("返回悬停目标所在的段落，正文外与代码块内返回 null", () => {
		const root = document.createElement("main");
		root.innerHTML = "<p>para <strong>bold</strong></p><pre><code>code</code></pre>";
		const outside = document.createElement("p");
		document.body.append(root, outside);
		try {
			const paragraph = root.querySelector("p") as HTMLElement;
			expect(closestAnnotatableBlock(root.querySelector("strong"), root)).toBe(paragraph);
			expect(closestAnnotatableBlock(root.querySelector("code"), root)).toBeNull();
			expect(closestAnnotatableBlock(outside, root)).toBeNull();
			expect(closestAnnotatableBlock(null, root)).toBeNull();
		} finally {
			root.remove();
			outside.remove();
		}
	});

	it("可运行块根（data-runnable）不可批注、不可作段评目标", () => {
		const root = document.createElement("main");
		root.innerHTML =
			'<p>ok</p><div data-runnable="true" data-source="print(1)"><button>运行</button><span>print(1)</span></div>';
		document.body.append(root);
		try {
			const runner = root.querySelector("[data-runnable]") as HTMLElement;
			const btn = root.querySelector("button") as HTMLElement;
			expect(closestAnnotatableBlock(btn, root)).toBeNull();
			expect(closestAnnotatableBlock(runner, root)).toBeNull();
			expect(closestAnnotatableBlock(root.querySelector("p"), root)).not.toBeNull();

			const text = runner.querySelector("span")!.firstChild as Text;
			const range = document.createRange();
			range.setStart(text, 0);
			range.setEnd(text, 4);
			expect(isSelectionInUnannotatableContainer(range)).toBe(true);
		} finally {
			root.remove();
		}
	});
});

describe("阅读节点的批注能力", () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement("article");
		root.setAttribute("data-article-content", "");
		root.innerHTML = `
			<h1>一级标题</h1><h6>六级标题</h6>
			<p>前文 <code>code</code> <a href="/blog">链接</a> <span data-type="inline-math" data-latex="E=mc^2"><span class="katex">重复的排版文字</span></span> 后文</p>
			<p>跨块终点</p>
			<table><tr><th>表头</th><td><p>单元格段落</p></td></tr></table>
			<p><img src="/image.png" alt="只含图片"></p>
			<p>含图文字 <img src="/image.png" alt="图"> 结尾</p>
			<figure><img src="/image.png" alt="图"><figcaption><p>图注文字</p></figcaption></figure>
			<div data-article-embed="dialogue"><p>对话卡文字</p></div>
			<div data-article-embed="tweet"><p>动态卡文字</p></div>
			<div data-article-embed="github"><aside><p>无效配置提示</p></aside></div>
			<details><summary>折叠摘要</summary><p>折叠正文</p></details>
			<div data-type="block-math" data-latex="x^2">块公式</div>
		`;
		document.body.append(root);
	});
	afterEach(() => {
		window.getSelection()?.removeAllRanges();
		root.remove();
	});

	it("标题与段落内代码、链接及行内公式均按原始 UTF-16/carrier 文本锚定并能重新定位", async () => {
		for (const heading of root.querySelectorAll<HTMLElement>("h1, h6")) {
			const text = heading.firstChild as Text;
			selectRange(text, 0, text, text.length);
			const anchor = await selectionToAnchor({ root });
			expect(anchor?.selectedText).toBe(text.textContent);
			expect(anchor?.blockId).toBe(await computeBlockId(text.textContent ?? ""));
			expect(await findBlockElement(root, anchor!.blockId)).toBe(heading);
		}
		const paragraph = root.querySelector("p")!;
		const code = paragraph.querySelector("code")!.firstChild as Text;
		const link = paragraph.querySelector("a")!.firstChild as Text;
		selectRange(code, 0, link, link.length);
		const anchor = await selectionToAnchor({ root });
		expect(anchor?.selectedText).toBe("code 链接");
		expect(anchor?.startOffset).toBe(3);
		const blocks = await extractCandidateBlocks(root);
		expect(blocks.some((block) => block.id === anchor?.blockId)).toBe(true);

		const math = paragraph.querySelector("[data-type='inline-math']")!;
		const glyph = math.querySelector(".katex")!.firstChild as Text;
		selectRange(glyph, 0, glyph, 1);
		expect(await selectionToAnchor({ root })).toMatchObject({
			startOffset: 11,
			endOffset: 17,
			selectedText: "E=mc^2",
		});
	});

	it("跨文本块只标记跨块；跨入表格、图片或嵌入卡一律视为不可批注", async () => {
		const paragraphs = root.querySelectorAll("p");
		const first = paragraphs[0]!.firstChild as Text;
		const second = paragraphs[1]!.firstChild as Text;
		selectRange(first, 0, second, 2);
		expect(selectionCapability(currentRange(), root)).toBe("cross-block");
		expect(await selectionToAnchor({ root })).toBeNull();

		const table = root.querySelector("th")!.firstChild as Text;
		selectRange(second, 0, table, table.length);
		expect(selectionCapability(currentRange(), root)).toBe("unsupported");
		expect(await selectionToAnchor({ root })).toBeNull();

		const mixedImage = root.querySelectorAll("p")[4]!;
		selectRange(mixedImage.firstChild as Text, 0, mixedImage.lastChild as Text, 2);
		expect(selectionCapability(currentRange(), root)).toBe("unsupported");
		expect(await selectionToAnchor({ root })).toBeNull();
		expect(closestAnnotatableBlock(mixedImage.querySelector("img"), root)).toBeNull();

		const dialogue = root.querySelector("[data-article-embed='dialogue'] p")!
			.firstChild as Text;
		selectRange(second, 0, dialogue, dialogue.length);
		expect(selectionCapability(currentRange(), root)).toBe("unsupported");
	});

	it("表格、图片、图注、卡片与摘要均不能新建整段或划词批注，折叠正文仍可批注", async () => {
		const unsupported = [
			...root.querySelectorAll<HTMLElement>(
				"th, td p, figcaption p, [data-article-embed] p, summary",
			),
			// 只含图片的段落
			root.querySelectorAll<HTMLElement>("p")[3] as HTMLElement,
		];
		for (const el of unsupported) {
			expect(closestAnnotatableBlock(el, root)).toBeNull();
			expect(await buildBlockAnchor(el)).toBeNull();
			const node = el.firstChild as Node;
			if (node?.nodeType !== Node.TEXT_NODE) continue;
			selectRange(node, 0, node, Math.min(2, node.textContent?.length ?? 0));
			expect(selectionCapability(currentRange(), root)).toBe("unsupported");
		}
		const body = root.querySelector<HTMLElement>("details p") as HTMLElement;
		expect(closestAnnotatableBlock(body, root)).toBe(body);
		expect((await buildBlockAnchor(body))?.selectedText).toBe("折叠正文");
		const text = body.firstChild as Text;
		selectRange(text, 0, text, 2);
		expect((await selectionToAnchor({ root }))?.selectedText).toBe("折叠");
	});

	it("嵌着代码块的引用整段不可批注，其中的文字段落照常可批注；图文混排段落可整段批注", async () => {
		root.insertAdjacentHTML(
			"beforeend",
			"<blockquote><p>引用里的说明</p><pre><code>code</code></pre></blockquote>",
		);
		const quote = root.querySelector<HTMLElement>("blockquote")!;
		const paragraph = quote.querySelector<HTMLElement>("p")!;
		expect(await buildBlockAnchor(quote)).toBeNull();
		expect(closestAnnotatableBlock(paragraph, root)).toBe(paragraph);
		expect((await buildBlockAnchor(paragraph))?.selectedText).toBe("引用里的说明");

		const mixed = root.querySelectorAll<HTMLElement>("p")[4]!;
		expect((await buildBlockAnchor(mixed))?.selectedText).toBe("含图文字  结尾");
	});
});
