import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlContent } from "../HtmlContent";
import { MarkdownContent } from "../MarkdownContent";

vi.mock("@/shared/ui/code-preview/use-shiki-highlight", () => ({
	useShikiHighlight: () => ({ html: "", loading: false }),
}));

const alertTypes = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
const readers = {
	Markdown: (content: string) => <MarkdownContent content={content} />,
	HTML: (content: string) => <HtmlContent html={content} />,
};

for (const [name, reader] of Object.entries(readers)) {
	describe(`${name} common syntax`, () => {
		it("renders native subscript and superscript without swallowing footnotes", () => {
			const { container } = render(
				reader(
					'<p>H<sub>2</sub>O and x<sup>2</sup><sup id="fnref-1"><a href="#fn-1" role="doc-noteref">1</a></sup></p><section data-footnotes><ol><li id="fn-1">Note <a href="#fnref-1" role="doc-backlink">Back</a></li></ol></section>',
				),
			);
			expect(container.querySelector("sub")?.textContent).toBe("2");
			expect(container.querySelector("sup")?.textContent).toBe("2");
			expect(container.querySelector("sup#fnref-1 a")?.getAttribute("href")).toBe("#fn-1");
			expect(container.querySelector("#fn-1 a")?.getAttribute("href")).toBe("#fnref-1");
		});

		it.each(
			alertTypes,
		)("renders %s with a visible type label and no live alert role", (type) => {
			const { container } = render(
				reader(
					`<blockquote data-type="alert" data-alert-type="${type}"><p>First <strong>bold</strong></p><p>Second</p><ul><li>Item</li></ul></blockquote>`,
				),
			);
			const alert = container.querySelector(`blockquote[data-alert-type="${type}"]`);
			expect(alert?.querySelector(".article-alert-title")?.textContent).toBe(type);
			expect(alert?.querySelectorAll("p")).toHaveLength(2);
			expect(alert?.querySelector("strong")?.textContent).toBe("bold");
			expect(alert?.querySelector("li")?.textContent).toBe("Item");
			expect(container.querySelector('[role="alert"]')).toBeNull();
		});

		it("preserves open defaults, nested details and native unwrapped bodies", () => {
			const { container } = render(
				reader(
					'<details open><summary>Outer <strong>title</strong></summary><div data-type="detailsContent"><p>First</p><p>Second</p><ul><li>Item</li></ul><details><summary>Inner</summary><p>Unwrapped body</p></details></div></details>',
				),
			);
			const details = container.querySelectorAll("details");
			expect(details).toHaveLength(2);
			expect(details[0]?.open).toBe(true);
			expect(details[1]?.open).toBe(false);
			expect(details[0]?.querySelector("summary strong")?.textContent).toBe("title");
			expect(details[0]?.querySelector('[data-type="detailsContent"]')).not.toBeNull();
			expect(details[0]?.querySelectorAll("p")).toHaveLength(3);
			expect(details[1]?.querySelector("p")?.textContent).toBe("Unwrapped body");
		});

		it("removes scripts, event handlers, unsafe URLs and unsafe styles", () => {
			const { container } = render(
				reader(
					'<details open ontoggle="alert(1)"><summary onclick="alert(1)">Safe</summary><p style="text-align:right;position:fixed"><span style="color:#ff0000;background-image:url(javascript:alert(1))">color</span><a href="javascript:alert(1)" onmouseover="alert(1)">link</a><img src="x" onerror="alert(1)"></p><script>alert(1)</script><iframe src="https://example.com"></iframe></details>',
				),
			);
			expect(
				container.querySelector(
					"script,iframe,[ontoggle],[onclick],[onmouseover],[onerror]",
				),
			).toBeNull();
			expect(container.querySelector("a")?.getAttribute("href")).toBeNull();
			expect(container.querySelector("p")?.style.textAlign).toBe("right");
			expect(container.querySelector("p")?.style.position).toBe("");
			expect(container.querySelector("span")?.style.color).toBe("rgb(255, 0, 0)");
			expect(container.querySelector("span")?.style.backgroundImage).toBe("");
		});

		it("keeps unknown HTML alert types as ordinary quotes", () => {
			const { container } = render(
				reader(
					'<blockquote data-type="alert" data-alert-type="UNKNOWN"><p>[!UNKNOWN] body</p></blockquote>',
				),
			);
			expect(container.querySelector("blockquote")?.textContent).toBe("[!UNKNOWN] body");
			expect(container.querySelector('[data-type="alert"]')).toBeNull();
		});
	});
}

describe("Markdown alert parsing", () => {
	it.each(
		alertTypes,
	)("recognizes %s at the beginning of a quote and preserves block content", (type) => {
		const { container } = render(
			<MarkdownContent
				content={`> [!${type}]\n> First **bold**\n>\n> Second\n>\n> - Item`}
			/>,
		);
		const alert = container.querySelector(`blockquote[data-alert-type="${type}"]`);
		expect(alert?.querySelector(".article-alert-title")?.textContent).toBe(type);
		expect(alert?.querySelectorAll("p")).toHaveLength(2);
		expect(alert?.querySelector("strong")?.textContent).toBe("bold");
		expect(alert?.querySelector("li")?.textContent).toBe("Item");
		expect(alert?.textContent).not.toContain(`[!${type}]`);
	});

	it("does not reinterpret escaped, encoded, unknown or code markers", () => {
		const { container } = render(
			<MarkdownContent
				content={
					"> \\[!NOTE]\n> Escaped\n\n> [\\!NOTE]\n> Escaped inside\n\n> &#91;!TIP]\n> Encoded\n\n> [!UNKNOWN]\n> Unknown\n\n> [!NOTE] inline text\n\n> [!NOTE]**same line**\n\n> `[!WARNING]`\n> Code\n\n`<sub>2</sub>`\n\n```text\n> [!CAUTION]\n<details><summary>Example</summary></details>\n```"
				}
			/>,
		);
		expect(container.querySelector('[data-type="alert"],details,sub')).toBeNull();
		expect(container.textContent).toContain("[!NOTE]");
		expect(container.textContent).toContain("[!TIP]");
		expect(container.textContent).toContain("[!UNKNOWN]");
	});

	it("supports Markdown blocks and alerts within native details", () => {
		const { container } = render(
			<MarkdownContent
				content={
					"<details open>\n<summary>Markdown body</summary>\n\nFirst paragraph.\n\n> [!TIP]\n> Nested **tip**\n\n- Item\n\n</details>"
				}
			/>,
		);
		const details = container.querySelector("details");
		expect(details?.open).toBe(true);
		expect(details?.querySelector("summary")?.textContent).toBe("Markdown body");
		expect(details?.querySelector('[data-alert-type="TIP"] strong')?.textContent).toBe("tip");
		expect(details?.querySelector("li")?.textContent).toBe("Item");
	});

	it("keeps Markdown strike syntax and math after HTML sanitization", async () => {
		const { container } = render(
			<MarkdownContent
				content={
					"H<sub>2</sub>O and x<sup>2</sup>, ~single~, ~~double~~, x^2^.\n\n$x^2$\n\n$$\nx^2\n$$"
				}
			/>,
		);
		expect(container.querySelectorAll("del")).toHaveLength(2);
		expect(container.textContent).toContain("x^2^");
		await waitFor(() => expect(container.querySelectorAll(".katex")).toHaveLength(2));
	});
});
