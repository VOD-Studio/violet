import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "../SiteFooter";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

describe("SiteFooter", () => {
	it("自定义版权文案优先于默认版权行", () => {
		render(<SiteFooter siteName="Violet" tagline="x" year={2026} copyright="版权所有" />);
		expect(screen.getByText("版权所有")).toBeTruthy();
	});

	it("外链在新标签页打开且带 noopener", () => {
		render(
			<SiteFooter
				siteName="Violet"
				tagline="x"
				year={2026}
				githubHref="https://github.com/xunrua"
				rssHref="/rss.xml"
			/>,
		);
		const github = screen.getByRole("link", { name: "GitHub" });
		expect(github.getAttribute("target")).toBe("_blank");
		expect(github.getAttribute("rel")).toContain("noopener");
		expect(screen.getByRole("link", { name: "RSS 订阅" }).getAttribute("href")).toBe(
			"/rss.xml",
		);
	});

	it("未提供 RSS 与 GitHub 地址时不渲染这两项", () => {
		render(<SiteFooter siteName="Violet" tagline="x" year={2026} />);
		expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
		expect(screen.queryByRole("link", { name: "RSS 订阅" })).toBeNull();
	});

	it("域名与挂件按需渲染", () => {
		const { rerender } = render(
			<SiteFooter
				siteName="Violet"
				tagline="x"
				year={2026}
				domain="xunrua.top"
				ornament={<i data-testid="orn" />}
			/>,
		);
		expect(screen.getByText("xunrua.top")).toBeTruthy();
		expect(screen.getByTestId("orn")).toBeTruthy();
		rerender(<SiteFooter siteName="Violet" tagline="x" year={2026} />);
		expect(screen.queryByText("xunrua.top")).toBeNull();
	});
});
