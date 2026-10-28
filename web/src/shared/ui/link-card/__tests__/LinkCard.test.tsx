import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkCard } from "../LinkCard";

const full = {
	url: "https://example.com/a",
	title: "页面标题",
	description: "页面描述",
	site_name: "Example",
	image_url: "/uploads/link-previews/x/cover.webp",
};

describe("LinkCard", () => {
	it("完整卡：标题、描述、站点名与封面", () => {
		render(<LinkCard card={full} />);
		const a = screen.getByRole("link");
		expect(a.getAttribute("href")).toBe("https://example.com/a");
		expect(a.getAttribute("target")).toBe("_blank");
		expect(a.getAttribute("rel")).toBe("noopener noreferrer");
		expect(screen.getByText("页面标题")).toBeTruthy();
		expect(screen.getByText("页面描述")).toBeTruthy();
		expect(screen.getByText("Example")).toBeTruthy();
		const img = a.querySelector("img");
		expect(img?.getAttribute("src")).toContain("/uploads/link-previews/x/cover.webp");
	});

	it("无封面渲染纯文本卡（无 img）", () => {
		render(<LinkCard card={{ ...full, image_url: "" }} />);
		expect(screen.getByRole("link").querySelector("img")).toBeNull();
		expect(screen.getByText("页面标题")).toBeTruthy();
	});

	it("标题缺失时用域名兜底", () => {
		render(<LinkCard card={{ ...full, title: "", site_name: "" }} />);
		// 标题与域名兜底行同显 host，属预期。
		const hits = screen.getAllByText("example.com");
		expect(hits.length).toBe(2);
	});
});
