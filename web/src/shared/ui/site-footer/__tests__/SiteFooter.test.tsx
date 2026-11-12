import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "../SiteFooter";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

function MarkedLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <a href={href} data-injected="true" {...props} />;
}

describe("SiteFooter", () => {
	it("三组链接标题与链接原文齐全，位于页脚导航内", () => {
		render(<SiteFooter siteName="Violet" tagline="一花一叶，皆成文章。" year={2026} />);
		const nav = screen.getByRole("navigation", { name: "页脚导航" });
		for (const heading of ["关于", "著述", "连接"]) {
			expect(within(nav).getByRole("heading", { name: heading })).toBeTruthy();
		}
		for (const name of [
			"关于本站",
			"友链来往",
			"开源项目",
			"文心长墨",
			"求索札记",
			"长卷连载",
			"光影撷影",
			"推文微动态",
		]) {
			expect(within(nav).getByRole("link", { name })).toBeTruthy();
		}
	});

	it("站名、格言与版权行取自 props", () => {
		render(<SiteFooter siteName="Rua" tagline="慢慢写。" year={2031} />);
		expect(screen.getByRole("link", { name: "Rua" })).toBeTruthy();
		expect(screen.getByText("慢慢写。")).toBeTruthy();
		expect(screen.getByText(/2031 Powered by Violet\./)).toBeTruthy();
		expect(screen.getByText("© 2031 Rua. All rights reserved.")).toBeTruthy();
	});

	it("自定义版权文案优先于默认版权行", () => {
		render(<SiteFooter siteName="Violet" tagline="x" year={2026} copyright="版权所有" />);
		expect(screen.getByText("版权所有")).toBeTruthy();
	});

	it("状态行是 status 区域", () => {
		render(<SiteFooter siteName="Violet" tagline="x" year={2026} />);
		expect(screen.getByRole("status").textContent).toBe("站点安静运行中");
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

	it("站内链接使用注入的 LinkComponent", () => {
		render(<SiteFooter siteName="Violet" tagline="x" year={2026} LinkComponent={MarkedLink} />);
		const about = screen.getByRole("link", { name: "关于本站" });
		expect(about.getAttribute("data-injected")).toBe("true");
		expect(about.getAttribute("href")).toBe("/about");
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
