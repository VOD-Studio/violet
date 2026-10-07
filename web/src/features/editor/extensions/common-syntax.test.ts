import { Editor } from "@tiptap/core";
import type { Root } from "hast";
import { raw } from "hast-util-raw";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { afterEach, describe, expect, it } from "vitest";
import { buildSlashItems } from "../slash-menu/slash-items";
import { blockItems, formatItems } from "../toolbar/toolbar-items";
import { buildEditorExtensions } from "./index";

const editors: Editor[] = [];
function editor(content: string, contentType: "markdown" | "html" = "markdown") {
	const instance = new Editor({ extensions: buildEditorExtensions(), content: "" });
	editors.push(instance);
	instance.commands.setContent(content, { contentType });
	return instance;
}
function roundtrip(instance: Editor) {
	return editor(editor(instance.getHTML(), "html").getMarkdown());
}
function selectText(instance: Editor, text: string) {
	let position = -1;
	instance.state.doc.descendants((node, pos) => {
		if (position < 0 && node.isText && node.text?.includes(text))
			position = pos + node.text.indexOf(text);
	});
	expect(position).toBeGreaterThanOrEqual(0);
	instance.commands.setTextSelection({ from: position, to: position + text.length });
}
function markdownHtml(source: string) {
	return renderToStaticMarkup(
		createElement(
			ReactMarkdown,
			{
				remarkPlugins: [remarkGfm],
				rehypePlugins: [() => (tree: Root) => raw(tree)],
			},
			source,
		),
	);
}
function expectClosedFootnotes(html: string, references: number, definitions: string[]) {
	const root = document.createElement("div");
	root.innerHTML = html;
	const refs = [...root.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")];
	const notes = [...root.querySelectorAll("li[data-footnote-label]")];
	const backrefs = [...root.querySelectorAll<HTMLAnchorElement>("a[data-footnote-backref]")];
	const ids = [...root.querySelectorAll("[id]")].map((node) => node.id);
	expect(refs).toHaveLength(references);
	expect(notes).toHaveLength(definitions.length);
	expect(backrefs).toHaveLength(references);
	expect(new Set(ids).size).toBe(ids.length);
	for (const link of [...refs, ...backrefs]) {
		expect(ids).toContain(link.getAttribute("href")?.slice(1));
	}
	for (const [index, text] of definitions.entries()) {
		expect(notes[index].textContent).toContain(text);
	}
}
afterEach(() => {
	for (const instance of editors.splice(0)) instance.destroy();
});

describe("native subscript and superscript", () => {
	it("preserves escaped text, adjacent marks and code through HTML and Markdown", () => {
		const first = editor(
			"<h2>H<sub>2</sub>O</h2><p><strong>A<sup>2 &amp; &lt; &gt; * _ \\</sup></strong><em><sup>B</sup>C</em> <code>x&lt;y</code> H<sub><em>i</em></sub></p>",
			"html",
		);
		expect(first.getMarkdown()).toContain("<sub>");
		expect(first.getMarkdown()).toContain("<sup>");
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
	});

	it("keeps single/double tilde strike and literal caret syntax unchanged", () => {
		const first = editor("H~2~O ~~gone~~ x^2^ H<sub>2</sub>O x<sup>2</sup>");
		const root = document.createElement("div");
		root.innerHTML = first.getHTML();
		expect(root.querySelectorAll("s")).toHaveLength(2);
		expect(root.querySelector("sub")?.textContent).toBe("2");
		expect(root.querySelector("sup")?.textContent).toBe("2");
		expect(first.getText()).toContain("x^2^");
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
	});

	it("keeps footnote sup nodes ahead of the generic superscript mark", () => {
		const first = editor(
			'<p>x<sup>2</sup> note<sup><a data-footnote-ref href="#fn-a">1</a></sup></p><section data-footnotes><ol><li id="fn-a"><p>Definition</p></li></ol></section>',
			"html",
		);
		const inline = first.getJSON().content?.[0].content ?? [];
		expect(inline.filter((node) => node.type === "footnoteReference")).toHaveLength(1);
		expect(inline.find((node) => node.type === "footnoteReference")?.marks).toBeUndefined();
		expect(roundtrip(first).getJSON()).toEqual(first.getJSON());
	});

	it("toolbar marks are mutually exclusive, active and undoable", () => {
		const instance = editor("value");
		selectText(instance, "value");
		const sub = formatItems.find((item) => item.id === "subscript");
		const sup = formatItems.find((item) => item.id === "superscript");
		if (!sub || !sup) throw new Error("上下标操作不存在");
		sub.run(instance);
		expect(sub.isActive(instance)).toBe(true);
		expect(sup.canRun?.(instance)).toBe(true);
		sup.run(instance);
		expect(sup.isActive(instance)).toBe(true);
		expect(sub.isActive(instance)).toBe(false);
		expect(sub.canRun?.(instance)).toBe(true);
		sup.run(instance);
		expect(sup.isActive(instance)).toBe(false);
		expect(instance.commands.undo()).toBe(true);
	});

	it("preserves marks inside lists and table cells", () => {
		const first = editor(
			"<ul><li><p>H<sub><strong>2</strong></sub>O</p></li></ul><table><tr><th><p>x<sup>2</sup></p></th></tr><tr><td><p>a<sub>i</sub></p></td></tr></table>",
			"html",
		);
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
	});
});

describe("native details", () => {
	it.each(["", " open"])("roundtrips native HTML without an inner wrapper (%s)", (open) => {
		const first = editor(
			`<details${open}><summary>A &amp; B * _</summary><p>First <strong>bold</strong> H<sub>2</sub>O</p><p>Second</p><ul><li><p>Item</p></li></ul><pre><code>&lt;details&gt; is code</code></pre></details>`,
			"html",
		);
		expect(first.getJSON().content?.[0]).toMatchObject({
			type: "details",
			attrs: { open: Boolean(open) },
		});
		expect(first.getHTML()).toContain('data-type="detailsContent"');
		expect(first.getMarkdown()).toContain("<summary>A &amp; B * _</summary>");
		expect(first.getMarkdown()).not.toContain(":::details");
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
	});

	it("imports complete HTML carriers in Markdown, including nested details", () => {
		const first = editor(
			'<details open><summary>Outer</summary><div data-type="detailsContent"><p>Before</p><details><summary>Inner</summary><p>Nested</p></details><p>After</p></div></details>',
		);
		expect(first.getJSON().content?.[0].type).toBe("details");
		expect(first.getText()).toContain("Nested");
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
	});

	it("the official disclosure button updates the saved default state and editable body", () => {
		const instance = editor("<details><summary>Title</summary><p>Body</p></details>", "html");
		const button = instance.view.dom.querySelector<HTMLButtonElement>(
			'[data-type="details"] > button',
		);
		expect(button).not.toBeNull();
		button?.click();
		expect(instance.state.doc.firstChild?.attrs.open).toBe(true);
		expect(button?.getAttribute("aria-expanded")).toBe("true");
		selectText(instance, "Body");
		instance.commands.insertContent("Edited body");
		expect(instance.getText()).toContain("Edited body");
		selectText(instance, "Title");
		instance.commands.insertContent("Edited title");
		expect(instance.getHTML()).toContain("<summary>Edited title</summary>");
		expect(roundtrip(instance).getJSON()).toEqual(instance.getJSON());
	});

	it("inserts editable summary, persists default state and unwraps without losing content", () => {
		const instance = editor("Body");
		selectText(instance, "Body");
		buildSlashItems(() => {})
			.find((item) => item.id === "details")
			?.command(instance);
		instance.commands.insertContent("Summary");
		expect(instance.getHTML()).toContain("<summary>Summary</summary>");
		expect(instance.isActive("details", { open: true })).toBe(true);
		instance.commands.updateAttributes("details", { open: false });
		expect(roundtrip(instance).getJSON()).toEqual(instance.getJSON());
		blockItems.find((item) => item.id === "details")?.run(instance);
		expect(instance.getJSON().content?.some((node) => node.type === "details")).toBe(false);
		expect(instance.getText()).toContain("Summary");
		expect(instance.getText()).toContain("Body");
		expect(instance.commands.undo()).toBe(true);
	});
});

describe("native HTML carrier integrity", () => {
	const note = '<sup><a data-footnote-ref href="#fn-a">1</a></sup>';
	const definitions =
		'<section data-footnotes><ol><li id="fn-a"><p>Shared definition <strong>bold</strong></p></li><li id="fn-b"><p>Other definition</p></li></ol></section>';
	it.each([
		["same paragraph sub/sup", `<p>H<sub>2</sub>O x<sup>2</sup>${note}</p>`],
		[
			"details and an outside repeated reference",
			`<details><summary>Title ${note}</summary><p>Inside ${note}</p><pre><code>first\n\n**literal**</code></pre></details>`,
		],
		[
			"complex table",
			`<table><tr><th colspan="2"><p>Heading</p></th></tr><tr><td><p>Cell ${note}</p><p>Second paragraph</p></td><td><p>Other cell</p></td></tr></table>`,
		],
	])("closes all targets through two Markdown roundtrips: %s", (_name, carrier) => {
		const first = editor(
			`${carrier}<p>Outside ${note} Other<sup><a data-footnote-ref href="#fn-b">2</a></sup></p>${definitions}`,
			"html",
		);
		const referenceCount = carrier.includes("<details") ? 4 : 3;
		let current = first;
		for (let pass = 0; pass < 2; pass++) {
			const markdown = current.getMarkdown();
			expect(markdown).not.toContain("[^");
			expectClosedFootnotes(markdownHtml(markdown), referenceCount, [
				"Shared definition bold",
				"Other definition",
			]);
			if (carrier.includes("<pre>")) {
				const root = document.createElement("div");
				root.innerHTML = markdownHtml(markdown);
				expect(root.querySelector("details pre code")?.textContent).toBe(
					"first\n\n**literal**",
				);
				expect(root.querySelector("details strong")).toBeNull();
			}
			current = editor(markdown);
			expectClosedFootnotes(current.getHTML(), referenceCount, [
				"Shared definition bold",
				"Other definition",
			]);
			expect(current.getJSON()).toEqual(first.getJSON());
		}
	});

	it.each([
		["details", "<details><summary>Code</summary>", "</details>", "details pre code"],
		["table", "<table><tr><td>", "</td></tr></table>", "table td pre code"],
	])("keeps code blank lines inside a %s carrier", (_name, before, after, selector) => {
		const first = editor(
			`${before}<pre><code>first\n\n**literal**</code></pre>${after}`,
			"html",
		);
		let current = first;
		for (let pass = 0; pass < 2; pass++) {
			const markdown = current.getMarkdown();
			expect(markdown).toContain("first&#10;&#10;**literal**");
			const root = document.createElement("div");
			root.innerHTML = markdownHtml(markdown);
			expect(root.querySelector(selector)?.textContent).toBe("first\n\n**literal**");
			expect(root.querySelector("strong")).toBeNull();
			current = editor(markdown);
			root.innerHTML = current.getHTML();
			expect(root.querySelector(selector)?.textContent).toBe("first\n\n**literal**");
			expect(root.querySelector("strong")).toBeNull();
			expect(current.getJSON()).toEqual(first.getJSON());
		}
	});

	it.each([
		"Plain[^a]\n\n[^a]: Definition",
		"H<sub>2</sub>O\n\nPlain[^a]\n\n[^a]: Definition",
		"<details><summary>Title</summary><p>No note inside</p></details>\n\nPlain[^a]\n\n[^a]: Definition",
		"| Heading |\n| --- |\n| Plain[^a] |\n\n[^a]: Definition",
	])("retains Markdown footnotes when no carrier contains a reference: %s", (source) => {
		const first = editor(source);
		expect(first.getMarkdown()).toContain("[^a]: Definition");
		expect(editor(first.getMarkdown()).getJSON()).toEqual(first.getJSON());
	});
});
