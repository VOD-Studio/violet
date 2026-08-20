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
import { isSelectionInUnannotatableContainer, selectionToAnchor } from "../selection-to-anchor";

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
