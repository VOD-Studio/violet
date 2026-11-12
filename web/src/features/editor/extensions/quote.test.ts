import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildEditorExtensions } from "./index";

const editors: Editor[] = [];

function editor(content: string, contentType: "html" | "markdown" = "html") {
	const instance = new Editor({ extensions: buildEditorExtensions(), content: "" });
	editors.push(instance);
	instance.commands.setContent(content, { contentType });
	return instance;
}

function documentOf(instance: Editor) {
	return new DOMParser().parseFromString(instance.getHTML(), "text/html");
}

afterEach(() => {
	for (const instance of editors) {
		instance.destroy();
	}
	editors.length = 0;
});

describe("引用出处与展示装饰", () => {
	it("隐藏装饰引号，序列化时只保留作者正文", () => {
		const instance = editor("<blockquote><p>引文</p></blockquote>");
		const decoration = instance.view.dom.querySelector("blockquote > .article-blockquote-mark");

		expect(decoration?.getAttribute("aria-hidden")).toBe("true");
		expect(instance.view.dom.querySelector("blockquote")?.textContent).toBe("引文");
		expect(documentOf(instance).body.textContent).toBe("引文");
		expect(instance.getMarkdown().trim()).toBe("> 引文");
	});

	it("编辑后保留出处属性并将新出处同步到视图与 Markdown", () => {
		const instance = editor(
			'<blockquote cite="https://example.com/source"><p>引文</p></blockquote>',
		);
		instance.commands.setTextSelection(2);
		instance.commands.insertContent("修订：");
		instance.commands.updateAttributes("blockquote", { cite: "https://example.com/revised" });

		expect(instance.view.dom.querySelector("blockquote cite")?.textContent).toBe(
			"https://example.com/revised",
		);
		expect(documentOf(instance).body.textContent).toBe("修订：引文");
		expect(documentOf(instance).querySelector("blockquote cite")).toBeNull();

		const restored = editor(instance.getMarkdown(), "markdown");
		const quote = documentOf(restored).querySelector("blockquote");
		expect(quote?.getAttribute("cite")).toBe("https://example.com/revised");
		expect(quote?.textContent).toBe("修订：引文");
	});

	it("保留作者引用出处的语义与混合格式", () => {
		const instance = editor(
			"<blockquote><p>引文</p><cite>《<strong>论语</strong>》</cite></blockquote>",
		);
		const restored = editor(instance.getMarkdown(), "markdown");
		const citation = documentOf(restored).querySelector("blockquote cite");

		expect(citation?.textContent).toBe("《论语》");
		expect(documentOf(restored).querySelector("blockquote strong")?.textContent).toBe("论语");
	});

	it("嵌套引用各有隐藏装饰，提示块不添加正文引号", () => {
		const instance = editor(
			[
				"<blockquote><p>外层</p><blockquote><p>内层</p></blockquote></blockquote>",
				'<blockquote data-type="alert" data-alert-type="NOTE"><p>提示</p></blockquote>',
			].join(""),
		);
		const quotes = instance.view.dom.querySelectorAll('blockquote:not([data-type="alert"])');
		for (const quote of quotes) {
			expect(quote.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
		}
		expect(quotes).toHaveLength(2);
		expect(
			instance.view.dom.querySelector(
				'blockquote[data-type="alert"] .article-blockquote-mark',
			),
		).toBeNull();
		expect(documentOf(instance).body.textContent).toBe("外层内层提示");
	});
});
