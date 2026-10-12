import { describe, expect, it } from "vitest";
import { clearMarks, wrapRange } from "../range-marks";

function block(html: string): HTMLElement {
	const el = document.createElement("p");
	el.innerHTML = html;
	return el;
}

describe("wrapRange", () => {
	it("区间落在单个文本节点内：只包裹该段，textContent 不变", () => {
		const el = block("hello world");
		const marks = wrapRange(el, { start: 6, end: 11 }, "m");
		expect(marks).toHaveLength(1);
		expect(marks[0].textContent).toBe("world");
		expect(el.textContent).toBe("hello world");
	});

	it("区间跨行内元素：每个文本节点各包一段", () => {
		const el = block("ab<strong>cd</strong>ef");
		const marks = wrapRange(el, { start: 1, end: 5 }, "m");
		expect(marks.map((m) => m.textContent)).toEqual(["b", "cd", "e"]);
		expect(el.textContent).toBe("abcdef");
	});

	it("区间为空或反向时不包裹", () => {
		const el = block("abc");
		expect(wrapRange(el, { start: 2, end: 2 }, "m")).toEqual([]);
		expect(wrapRange(el, { start: 3, end: 1 }, "m")).toEqual([]);
	});

	it("KaTeX 内的文本跳过包裹但仍计入偏移", () => {
		const el = block('ab<span class="katex">xy</span>cd');
		const marks = wrapRange(el, { start: 1, end: 6 }, "m");
		expect(marks.map((m) => m.textContent)).toEqual(["b", "cd"]);
	});

	it("写入 dataset", () => {
		const el = block("abc");
		const [mark] = wrapRange(el, { start: 0, end: 2 }, "m", { annotationBlock: "b1" });
		expect(mark.dataset.annotationBlock).toBe("b1");
	});

	it("inline-math carrier 按 data-latex 计长，不按 KaTeX textContent", () => {
		const el = block(
			'前<span data-type="inline-math" data-latex="E=mc^2"><span class="katex">E=mc2E=mc^2E=mc2</span></span>后',
		);
		// carrier 文本「前E=mc^2后」：选「后」→ start=7 end=8
		const marks = wrapRange(el, { start: 7, end: 8 }, "m");
		expect(marks.map((m) => m.textContent)).toEqual(["后"]);
	});
});

describe("clearMarks", () => {
	it("还原为原始文本并合并相邻文本节点", () => {
		const el = block("ab<strong>cd</strong>ef");
		wrapRange(el, { start: 1, end: 5 }, "m");
		clearMarks(el, "m");
		expect(el.innerHTML).toBe("ab<strong>cd</strong>ef");
		expect(el.firstChild?.nodeValue).toBe("ab");
	});
});
