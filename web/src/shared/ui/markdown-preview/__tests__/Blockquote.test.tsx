import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlContent } from "../HtmlContent";
import { MarkdownContent } from "../MarkdownContent";

vi.mock("@/shared/ui/code-preview/use-shiki-highlight", () => ({
	useShikiHighlight: () => ({ html: "", loading: false }),
}));

const readers = {
	Markdown: (content: string) => <MarkdownContent content={content} />,
	HTML: (content: string) => <HtmlContent html={content} />,
};

for (const [name, reader] of Object.entries(readers)) {
	describe(`${name} blockquote`, () => {
		it("keeps decorative quotation marks out of accessible content", () => {
			const { container } = render(reader("<blockquote><p>引文</p></blockquote>"));
			const quote = container.querySelector("blockquote");
			const decoration = quote?.querySelector(".article-blockquote-mark");
			expect(decoration?.getAttribute("aria-hidden")).toBe("true");
			expect(quote?.textContent).toBe("引文");
			expect(quote?.getAttribute("data-type")).toBeNull();
		});

		it("shows the cite attribute as the source line", () => {
			const { container } = render(
				reader('<blockquote cite="https://example.com/source"><p>引文</p></blockquote>'),
			);
			const quote = container.querySelector("blockquote");
			expect(quote?.getAttribute("cite")).toBe("https://example.com/source");
			expect(quote?.querySelector("cite")?.textContent).toBe("https://example.com/source");
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
			expect(alert?.getAttribute("data-type")).toBe("alert");
			expect(alert?.querySelector("span")?.textContent).toBe("NOTE");
			expect(alert?.querySelector(".article-blockquote-mark")).toBeNull();
		});
	});
}
