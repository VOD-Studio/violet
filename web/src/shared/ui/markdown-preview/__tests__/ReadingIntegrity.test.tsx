import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlContent } from "../HtmlContent";
import { MarkdownContent } from "../MarkdownContent";

vi.mock("@/shared/ui/code-preview/use-shiki-highlight", () => ({
	useShikiHighlight: () => ({ html: "", loading: false }),
}));
vi.mock("@/shared/ui/diagram/render-mermaid", () => ({
	renderMermaid: async () => ({
		svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>',
	}),
}));
// CodeMirror 依赖浏览器几何信息，仅替换其编辑区边界，保留真实 CodeRunner。
vi.mock("@/shared/ui/code-runner/components/CodeMirrorEditor", () => ({
	CodeMirrorEditor: ({ value }: { value: string }) => (
		<textarea aria-label="Code source" defaultValue={value} />
	),
}));

function expectNavigableFootnotes(container: HTMLElement) {
	const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
	expect(links.length).toBeGreaterThanOrEqual(4);
	for (const link of links) {
		const id = decodeURIComponent(link.hash.slice(1));
		expect(
			Array.from(container.querySelectorAll("[id]")).filter((node) => node.id === id),
		).toHaveLength(1);
		expect(link.target).toBe("");
	}
	const ids = Array.from(container.querySelectorAll("[id]")).map((node) => node.id);
	expect(new Set(ids).size).toBe(ids.length);
}

describe("article reading integrity", () => {
	it("preserves footnote numbers when definitions remain in source order", () => {
		const { container } = render(
			<HtmlContent html='<section data-footnotes><ol><li id="fn-second" value="2">Second reference</li><li id="fn-first" value="1">First reference</li></ol></section>' />,
		);
		expect(Array.from(container.querySelectorAll("li"), (item) => item.value)).toEqual([2, 1]);
	});

	it("preserves safe alignment, merged cells, color and ordered-list starts without arbitrary styles", () => {
		const { container } = render(
			<HtmlContent
				html={
					'<h2 style="text-align:center;position:fixed">Title</h2><p style="text-align:right">Paragraph <span style="color:#ff0000;background-image:url(https://example.com/pixel)">red</span><span style="color:var(--untrusted)">unsafe</span></p><ol start="7"><li>seven</li></ol><table><tbody><tr><th align="right" colspan="2" rowspan="3">heading</th><td style="text-align:center" colspan="2" rowspan="2">cell</td></tr></tbody></table>'
				}
			/>,
		);
		expect(container.querySelector("h2")?.style.textAlign).toBe("center");
		expect(container.querySelector("h2")?.style.position).toBe("");
		expect(container.querySelector("p")?.style.textAlign).toBe("right");
		expect(container.querySelector<HTMLSpanElement>("p span")?.style.color).toBe(
			"rgb(255, 0, 0)",
		);
		expect(container.querySelector<HTMLSpanElement>("p span")?.style.backgroundImage).toBe("");
		expect(container.querySelectorAll("p span")[1]?.getAttribute("style")).toBeNull();
		expect(container.querySelector("ol")?.start).toBe(7);
		expect(container.querySelector("th")?.colSpan).toBe(2);
		expect(container.querySelector("th")?.rowSpan).toBe(3);
		expect(container.querySelector("th")?.style.textAlign).toBe("right");
		expect(container.querySelector("td")?.style.textAlign).toBe("center");
		expect(container.querySelector("td")?.colSpan).toBe(2);
		expect(container.querySelector("td")?.rowSpan).toBe(2);
	});

	it("keeps link metadata and fragment navigation while rejecting unsafe links and event handlers", () => {
		const { container } = render(
			<HtmlContent
				html={
					'<p id="destination">target</p><a id="jump" href="#destination" title="Jump" aria-label="Go to target" onclick="alert(1)">jump</a><a href="https://example.com" title="External">external</a><a href="javascript:alert(1)">unsafe</a><script>alert(1)</script><iframe src="https://example.com"></iframe>'
				}
			/>,
		);
		const links = container.querySelectorAll("a");
		expect(links[0]?.id).toBe("jump");
		expect(links[0]?.title).toBe("Jump");
		expect(links[0]?.getAttribute("aria-label")).toBe("Go to target");
		expect(links[0]?.getAttribute("onclick")).toBeNull();
		expect(links[0]?.target).toBe("");
		expect(links[1]?.target).toBe("_blank");
		expect(links[1]?.rel).toBe("noopener noreferrer");
		expect(links[2]?.getAttribute("href")).toBeNull();
		expect(container.querySelector("script,iframe")).toBeNull();
		expect(container.querySelector("#destination")).not.toBeNull();
	});

	it("keeps repeated Goldmark footnote references and both return targets", () => {
		const { container } = render(
			<HtmlContent
				html={
					'<p>A<sup id="fnref:1"><a href="#fn:1" role="doc-noteref">1</a></sup> B<sup id="fnref1:1"><a href="#fn:1" role="doc-noteref">1</a></sup></p><div class="footnotes" role="doc-endnotes"><ol><li id="fn:1"><p>note <a href="#fnref:1" role="doc-backlink" aria-label="Back to reference 1">↩</a> <a href="#fnref1:1" role="doc-backlink">↩</a></p></li></ol></div>'
				}
			/>,
		);
		expectNavigableFootnotes(container);
		expect(container.querySelector('[role="doc-endnotes"]')).not.toBeNull();
	});

	it("keeps remark footnote markers and unique repeated reference targets", () => {
		const { container } = render(
			<MarkdownContent content={"A[^same] and B[^same].\n\n[^same]: Footnote body."} />,
		);
		expectNavigableFootnotes(container);
		expect(container.querySelectorAll("a[data-footnote-ref]")).toHaveLength(2);
		expect(container.querySelectorAll("a[data-footnote-backref]")).toHaveLength(2);
		expect(container.querySelector("#user-content-fn-same")).not.toBeNull();
		expect(container.querySelector("#user-content-fnref-same")).not.toBeNull();
		expect(container.querySelector('[id^="user-content-user-content-"]')).toBeNull();
		expect(
			container.querySelector("a[data-footnote-ref]")?.getAttribute("aria-describedby"),
		).toBe("footnote-label");
	});

	it("reads remark-compatible HTML footnotes and editor labels through the sanitizer", () => {
		const { container } = render(
			<HtmlContent
				html={
					'<p>A<sup><a id="user-content-fnref-note" href="#user-content-fn-note" data-footnote-ref data-footnote-label="note" aria-describedby="footnote-label">1</a></sup> B<sup><a id="user-content-fnref-note-2" href="#user-content-fn-note" data-footnote-ref>1</a></sup></p><section data-footnotes role="doc-endnotes"><h2 id="footnote-label">Footnotes</h2><ol><li id="user-content-fn-note" data-footnote-label="note"><p>body <a href="#user-content-fnref-note" data-footnote-backref aria-label="Back to reference">↩</a> <a href="#user-content-fnref-note-2" data-footnote-backref>↩</a></p></li></ol></section>'
				}
			/>,
		);
		expectNavigableFootnotes(container);
		expect(container.querySelector("section[data-footnotes]")).not.toBeNull();
		expect(container.querySelector("li")?.getAttribute("data-footnote-label")).toBe("note");
		expect(
			container.querySelector("a[data-footnote-ref]")?.getAttribute("aria-describedby"),
		).toBe("footnote-label");
		expect(
			container.querySelector("a[data-footnote-backref]")?.getAttribute("aria-label"),
		).toBe("Back to reference");
	});

	it.each([
		'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>',
		'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>',
		'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>parent</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><input type="checkbox"><p>child</p></li></ul></li></ul>',
	])("renders one read-only checkbox per HTML task without duplication", (html) => {
		const { container } = render(<HtmlContent html={html} />);
		const checkboxes = container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]');
		expect(checkboxes).toHaveLength(2);
		expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("true");
		expect(checkboxes[1]?.getAttribute("aria-checked")).toBe("false");
		for (const checkbox of checkboxes) expect(checkbox.disabled).toBe(true);
	});

	it("renders Markdown tasks, table alignment and ordered starts", () => {
		const { container } = render(
			<MarkdownContent
				content={
					"7. seven\n8. eight\n\n- [x] done\n- [ ] todo\n\n| right | center |\n| ---: | :---: |\n| a | b |"
				}
			/>,
		);
		expect(container.querySelector("ol")?.start).toBe(7);
		expect(container.querySelectorAll('[role="checkbox"]')).toHaveLength(2);
		expect(container.querySelectorAll("th")[0]?.style.textAlign).toBe("right");
		expect(container.querySelectorAll("th")[1]?.style.textAlign).toBe("center");
	});

	it("renders highlight outside code and mermaid through the registered reader", async () => {
		const { container } = render(
			<MarkdownContent
				content={
					"==marked **bold**== and `==literal==` and \\==escaped==.\n\n```text\n==code==\n```\n\n```mermaid\ngraph TD; A-->B\n```"
				}
			/>,
		);
		expect(container.querySelectorAll("mark")).toHaveLength(1);
		expect(container.querySelector("mark strong")?.textContent).toBe("bold");
		expect(container.textContent).toContain("==literal==");
		expect(container.textContent).toContain("==escaped==");
		expect(container.textContent).toContain("==code==");
		await waitFor(() => expect(container.querySelector('div[role="img"] svg')).not.toBeNull());
	});

	it("uses the real code runner for runnable fences and HTML carriers", async () => {
		const markdown = render(
			<MarkdownContent
				content={'```js run {"timeout_secs": 10}\nconsole.log("==literal==")\n```'}
			/>,
		);
		await waitFor(() =>
			expect(markdown.queryByRole("button", { name: "运行" })).not.toBeNull(),
		);
		expect((markdown.getByLabelText("Code source") as HTMLTextAreaElement).value).toBe(
			'console.log("==literal==")',
		);
		expect(markdown.container.textContent).toContain("node");
		expect(markdown.container.querySelector("mark")).toBeNull();
		markdown.unmount();
		const html = render(
			<HtmlContent
				html={
					'<pre data-runnable="true" data-lang="node" data-overrides="{&quot;timeout_secs&quot;:10}" data-source="console.log(&quot;==literal==&quot;)"><code>console.log(&quot;==literal==&quot;)</code></pre>'
				}
			/>,
		);
		await waitFor(() => expect(html.queryByRole("button", { name: "运行" })).not.toBeNull());
		expect((html.getByLabelText("Code source") as HTMLTextAreaElement).value).toBe(
			'console.log("==literal==")',
		);
		expect(html.container.textContent).toContain("node");
	});
});
