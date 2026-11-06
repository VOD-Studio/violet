import { SEASONS } from "@shared/lib/theme-preference";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SeasonGlyph } from "../season-glyphs";

const markup = (season: (typeof SEASONS)[number]) => {
	const { container, unmount } = render(<SeasonGlyph season={season} />);
	const html = container.querySelector("svg")?.innerHTML;
	unmount();
	return html;
};

describe("SeasonGlyph", () => {
	afterEach(cleanup);

	it("四季各画不同的图形", () => {
		const shapes = SEASONS.map(markup);
		expect(shapes.every((html) => html && html.length > 0)).toBe(true);
		expect(new Set(shapes).size).toBe(SEASONS.length);
	});

	it("春是五瓣加花心、秋是四瓣加花心、夏是圆加指针、冬是描边线条", () => {
		const count = (season: (typeof SEASONS)[number], selector: string) => {
			const { container, unmount } = render(<SeasonGlyph season={season} />);
			const n = container.querySelectorAll(selector).length;
			unmount();
			return n;
		};
		expect(count("spring", "circle")).toBe(6);
		expect(count("autumn", "circle")).toBe(5);
		expect(count("summer", "circle")).toBe(1);
		expect(count("summer", "path")).toBe(1);
		expect(count("winter", "circle")).toBe(0);
		expect(count("winter", "path")).toBe(1);
	});

	it("size 与 className 透传到 svg", () => {
		const { container } = render(
			<SeasonGlyph season="spring" size={18} className="glyph-probe" />,
		);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("18");
		expect(svg?.getAttribute("height")).toBe("18");
		expect(svg?.getAttribute("class")).toContain("glyph-probe");
	});

	it("默认线宽 1.8，可用 strokeWidth 覆盖", () => {
		const { container, rerender } = render(<SeasonGlyph season="winter" />);
		expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("1.8");
		rerender(<SeasonGlyph season="winter" strokeWidth={3} />);
		expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("3");
	});

	it("默认对读屏隐藏，带名称时不再隐藏", () => {
		const { container, rerender } = render(<SeasonGlyph season="autumn" />);
		expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
		rerender(<SeasonGlyph season="autumn" aria-label="秋" />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("aria-hidden")).toBeNull();
		expect(svg?.getAttribute("aria-label")).toBe("秋");
	});
});
