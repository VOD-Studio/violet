import { Editor, generateHTML } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildFootnoteReferenceItems, buildSlashItems } from "../slash-menu/slash-items";
import { buildEditorExtensions } from "./index";

const editors: Editor[] = [];
function editor(content: string, contentType: "markdown" | "html" = "markdown") {
	const instance = new Editor({ extensions: buildEditorExtensions(), content: "" });
	editors.push(instance);
	instance.commands.setContent(content, { contentType });
	return instance;
}
function roundtrip(source: Editor) {
	const html = editor(source.getHTML(), "html");
	return editor(html.getMarkdown());
}
afterEach(() => {
	for (const instance of editors.splice(0)) instance.destroy();
});

describe("editor Markdown integrity", () => {
	it("初始 Markdown 的脚注属性可直接静态序列化，不依赖活动编辑器", () => {
		const instance = new Editor({
			extensions: buildEditorExtensions(),
			contentType: "markdown",
			content: "第一次[^a]，再次[^a]。\n\n[^a]: 正文。",
		});
		editors.push(instance);
		const html = generateHTML(instance.getJSON(), buildEditorExtensions());
		const root = document.createElement("div");
		root.innerHTML = html;
		expect([...root.querySelectorAll("a[data-footnote-ref]")].map((node) => node.id)).toEqual([
			"fnref-a-1",
			"fnref-a-2",
		]);
		expect(root.querySelectorAll("a[data-footnote-backref]")).toHaveLength(2);
	});

	it("前置插入与删除重复引用会更新未编辑引用的编号、ID和正文回链", () => {
		const instance = editor("原引用[^a]。\n\n[^a]: 原脚注。");
		instance.commands.setTextSelection(1);
		instance.commands.insertFootnote();
		instance.commands.insertContent("新脚注。");
		const labels = [...instance.view.dom.querySelectorAll("a[data-footnote-ref]")];
		expect(labels.map((node) => node.textContent)).toEqual(["1", "2"]);
		expect(
			instance.view.dom.querySelector('li[data-footnote-label="a"]')?.getAttribute("value"),
		).toBe("2");
		instance.commands.setTextSelection(1);
		instance.commands.insertFootnote("a");
		expect(
			[...instance.view.dom.querySelectorAll('a[data-footnote-label="a"]')].map(
				(node) => node.id,
			),
		).toEqual(["fnref-a-1", "fnref-a-2"]);
		expect(
			instance.view.dom.querySelectorAll(
				'li[data-footnote-label="a"] a[data-footnote-backref]',
			),
		).toHaveLength(2);
		instance.commands.deleteRange({ from: 1, to: 2 });
		expect(instance.view.dom.querySelector('a[data-footnote-label="a"]')?.id).toBe("fnref-a-1");
		expect(
			instance.view.dom.querySelectorAll(
				'li[data-footnote-label="a"] a[data-footnote-backref]',
			),
		).toHaveLength(1);
		const html = generateHTML(instance.getJSON(), buildEditorExtensions());
		expect(html).toBe(instance.getHTML());
	});

	it("脚注正文相互引用时归一化不追加循环事务", () => {
		const instance = editor("正文。\n\n[^a]: 引用[^b]。\n\n[^b]: 引用[^a]。");
		const before = instance.getJSON();
		instance.commands.setMeta("footnote-test", true);
		expect(instance.getJSON()).toEqual(before);
		expect(instance.getHTML().match(/data-footnote-backref=/g)).toHaveLength(2);
	});

	it("retains pipes, inline code, backslashes and column alignment over two edits", () => {
		const first = editor(
			"| Left | Right |\n| :--- | ---: |\n| a\\|b | `x\\|y` |\n| c\\\\d | e\\|f |",
		);
		const second = roundtrip(first);
		const third = roundtrip(second);
		expect(third.getJSON()).toEqual(first.getJSON());
		expect(third.getText()).toContain("a|b");
		expect(third.getText()).toContain("x|y");
		expect(third.getHTML()).toContain("text-align: right");
	});

	it("preserves merged cells and code containing a literal backslash before a pipe as HTML", () => {
		const first = editor(
			'<table><tbody><tr><th colspan="2">Joined</th></tr><tr><td rowspan="2"><p><code>a\\|b</code></p></td><td>one</td></tr><tr><td>two</td></tr></tbody></table>',
			"html",
		);
		expect(first.getMarkdown()).toContain("<table");
		const result = roundtrip(roundtrip(first));
		expect(result.getJSON()).toEqual(first.getJSON());
	});

	it("keeps repeated footnotes editable with unique reference IDs and backlinks", () => {
		const first = editor(
			"First[^note], again[^note].\n\n[^note]: A **rich** note.\n\n    Second paragraph.",
		);
		const second = roundtrip(first);
		const third = roundtrip(second);
		expect(third.getJSON()).toEqual(first.getJSON());
		const html = document.createElement("div");
		html.innerHTML = third.getHTML();
		const references = [...html.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")];
		expect(references).toHaveLength(2);
		expect(new Set(references.map((reference) => reference.id)).size).toBe(2);
		expect(html.querySelectorAll("li[data-footnote-label]")).toHaveLength(1);
		expect(html.querySelector("li strong")?.textContent).toBe("rich");
		expect(html.querySelector("li")?.textContent).toContain("Second paragraph.");
		for (const reference of references) {
			expect(html.querySelector(`[id="${reference.hash.slice(1)}"]`)).not.toBeNull();
			expect(
				html.querySelector(`a[data-footnote-backref][href="#${reference.id}"]`),
			).not.toBeNull();
		}
	});

	it.each([
		'<p>A<sup id="fnref:1"><a href="#fn:1" role="doc-noteref">1</a></sup> B<sup id="fnref1:1"><a href="#fn:1" role="doc-noteref">1</a></sup></p><div class="footnotes" role="doc-endnotes"><hr><ol><li id="fn:1"><p>Goldmark <strong>note</strong> <a href="#fnref:1" role="doc-backlink">↩</a> <a href="#fnref1:1" role="doc-backlink">↩</a></p></li></ol></div>',
		'<p>A<sup><a href="#user-content-fn-note" id="user-content-fnref-note" data-footnote-ref>1</a></sup> B<sup><a href="#user-content-fn-note" id="user-content-fnref-note-2" data-footnote-ref>1</a></sup></p><section data-footnotes><h2>Footnotes</h2><ol><li id="user-content-fn-note"><p>Remark <strong>note</strong> <a href="#user-content-fnref-note" data-footnote-backref>↩</a></p></li></ol></section>',
	])("imports external standard footnote HTML and preserves repeated relationships", (source) => {
		const first = editor(source, "html");
		const result = roundtrip(first);
		expect(result.getHTML().match(/data-footnote-ref=/g)).toHaveLength(2);
		expect(result.getHTML().match(/data-footnote-label=/g)).toHaveLength(3);
		expect(result.getText()).not.toContain("↩");
		expect(result.getJSON()).toEqual(first.getJSON());
	});

	it("inserts, edits and reuses a footnote through the slash-menu commands", () => {
		const instance = editor("Body");
		instance.commands.setTextSelection(5);
		buildSlashItems(() => {})
			.find((item) => item.id === "footnote")
			?.command(instance);
		instance.commands.insertContent("Editable note");
		expect(instance.getMarkdown()).toContain("[^1]: Editable note");
		instance.commands.setTextSelection(1);
		const existing = buildFootnoteReferenceItems(instance);
		expect(existing).toHaveLength(1);
		existing[0].command(instance);
		const result = roundtrip(instance);
		expect(result.getHTML().match(/data-footnote-ref=/g)).toHaveLength(2);
		expect(result.getHTML().match(/<li /g)).toHaveLength(1);
		expect(result.getText()).toContain("Editable note");
	});

	it.each([
		"~~~mermaid\nflowchart TD\n A --> B\n~~~~",
		"````mermaid\nflowchart TD\n A --> B\n`````",
		"   ```mermaid\n   flowchart TD\n   A --> B\n   ```",
		"~~~mermaid\nflowchart TD\n A --> B",
	])("uses marked fence rules for Mermaid: %s", (source) => {
		const first = editor(source);
		expect(first.getJSON().content?.[0].type).toBe("diagramBlock");
		expect(roundtrip(first).getJSON()).toEqual(first.getJSON());
	});

	it("keeps runnable language, spaced overrides and nested fence examples", () => {
		const first = editor(
			'~~~javascript run {"timeout_secs": 10, "memory_mb": 128}\nconsole.log("```");\n~~~',
		);
		expect(first.getJSON().content?.[0].attrs).toMatchObject({
			language: "node",
			runnable: true,
			overrides: '{"timeout_secs":10,"memory_mb":128}',
		});
		expect(roundtrip(roundtrip(first)).getJSON()).toEqual(first.getJSON());
		const example = editor(
			"````markdown\n[^a]: not a footnote\n```mermaid\ngraph TD\n```\n````",
		);
		expect(example.getJSON().content?.[0].type).toBe("codeBlock");
		expect(roundtrip(example).getJSON()).toEqual(example.getJSON());
	});

	it("collects separated definitions at the end without changing reference relationships", () => {
		const first = editor(
			"[^alpha]: First note.\n\nBody[^alpha] and another[^beta].\n\n[^beta]: Second note.",
		);
		expect(first.getJSON().content?.at(-1)?.type).toBe("footnotes");
		expect(first.getJSON().content?.filter((node) => node.type === "footnotes")).toHaveLength(
			1,
		);
		expect(roundtrip(first).getJSON()).toEqual(first.getJSON());
	});

	it("imports the runnable HTML source carrier without reading highlighted markup", () => {
		const first = editor(
			'<pre data-runnable="true" data-lang="python" data-overrides=\'{"timeout_secs":10}\' data-source="print(&quot;exact&quot;)"><code class="language-python">not the original source</code></pre>',
			"html",
		);
		expect(first.state.doc.firstChild?.textContent).toBe('print("exact")');
		expect(roundtrip(first).getJSON()).toEqual(first.getJSON());
	});

	it("retains task check state and highlight markup through both formats", () => {
		const first = editor(
			'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done <mark>highlight</mark></p></li><li data-type="taskItem" data-checked="false"><p>Pending</p></li></ul>',
			"html",
		);
		const result = roundtrip(first);
		expect(result.getHTML()).toContain('data-checked="true"');
		expect(result.getHTML()).toContain('data-checked="false"');
		expect(result.getHTML()).toContain("<mark>highlight</mark>");
		expect(result.getText()).toContain("Done highlight");
	});
});
