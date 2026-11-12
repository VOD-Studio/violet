import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HtmlContent } from "../HtmlContent";
import { MarkdownContent } from "../MarkdownContent";

const readers = {
	Markdown: (content: string) => <MarkdownContent content={content} />,
	HTML: (content: string) => <HtmlContent html={content} />,
};

/** 按 `}` 切出顶层规则，便于断言选择器与声明的归属。 */
const cssRules = readFileSync("src/shared/ui/article-blocks/article-blocks.css", "utf8")
	.split("}")
	.map((rule) => rule.trim())
	.filter(Boolean);

for (const [name, reader] of Object.entries(readers)) {
	describe(`${name} blockquote`, () => {
		it("renders a plain quote without card styling or alert title", () => {
			const { container } = render(reader("<blockquote><p>引文</p></blockquote>"));
			const quote = container.querySelector("blockquote");
			expect(quote?.className).toBe("article-blockquote");
			expect(quote?.querySelector(".article-alert-title")).toBeNull();
			expect(quote?.getAttribute("data-type")).toBeNull();
			expect(quote?.querySelector("p")?.textContent).toBe("引文");
		});

		it("shows the cite attribute as the source line", () => {
			const { container } = render(
				reader('<blockquote cite="https://example.com/source"><p>引文</p></blockquote>'),
			);
			const quote = container.querySelector("blockquote");
			expect(quote?.getAttribute("cite")).toBe("https://example.com/source");
			expect(quote?.querySelector("cite.article-blockquote-cite")?.textContent).toBe(
				"https://example.com/source",
			);
		});

		it("keeps an authored cite element inside the quote", () => {
			const { container } = render(
				reader("<blockquote><p>引文</p><cite>《论语》</cite></blockquote>"),
			);
			expect(container.querySelector("blockquote cite")?.textContent).toBe("《论语》");
		});

		it("keeps alert quotes outside the plain quote contract", () => {
			const { container } = render(
				reader(
					'<blockquote data-type="alert" data-alert-type="NOTE"><p>提示</p></blockquote>',
				),
			);
			const alert = container.querySelector("blockquote");
			expect(alert?.className).toBe("");
			expect(alert?.querySelector(".article-alert-title")?.textContent).toBe("NOTE");
			expect(container.querySelector(".article-blockquote")).toBeNull();
		});
	});
}

describe("article quote stylesheet", () => {
	it("targets the article and editor render paths with the same decorative mark", () => {
		const markRule = cssRules.find((rule) => rule.includes('content: "“"'));
		expect(markRule).toBeDefined();
		expect(markRule).toContain(".article-blockquote");
		expect(markRule).toContain('.ProseMirror blockquote:not([data-type="alert"])');
		expect(markRule).toContain("var(--decoration) 70%");
		expect(markRule).toContain("var(--font-serif)");
		expect(markRule).toContain("font-size: 2.5rem");
	});

	it("drops the border, the background and the 24px indent on the quote box itself", () => {
		const boxRule = cssRules.find((rule) => rule.includes("padding-inline: 1.5rem 0"));
		expect(boxRule).toBeDefined();
		expect(boxRule).toContain('.ProseMirror blockquote:not([data-type="alert"])');
		expect(boxRule).toContain("border: 0");
		expect(boxRule).toContain("background: none");
	});
});
