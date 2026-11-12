import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Footer from "../Footer";

const settings = vi.hoisted(() => ({ data: undefined as Record<string, string> | undefined }));

vi.mock("@features/settings/api/queries", () => ({ useSettings: () => ({ data: settings.data }) }));
vi.mock("@features/seasonal-decor/ui/ornaments", () => ({
	FooterOrnament: () => <i data-testid="ornament" />,
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

describe("Footer", () => {
	beforeEach(() => {
		settings.data = undefined;
	});

	it("没有站点设置时使用默认站名与格言，并带上季节挂件", () => {
		render(<Footer />);
		expect(screen.getByRole("link", { name: "Violet" })).toBeTruthy();
		expect(screen.getByText("一花一叶，皆成文章。")).toBeTruthy();
		expect(screen.getByTestId("ornament")).toBeTruthy();
	});

	it("站名、格言、域名与外链来自站点设置，本地域名不显示", () => {
		settings.data = {
			site_name: "Rua",
			tagline: "慢慢写。",
			site_url: "https://xunrua.top/",
			github_username: "xunrua",
			social_rss: "/rss.xml",
		};
		render(<Footer />);
		expect(screen.getByRole("link", { name: "Rua" })).toBeTruthy();
		expect(screen.getByText("慢慢写。")).toBeTruthy();
		expect(screen.getByText("xunrua.top")).toBeTruthy();
		expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(
			"https://github.com/xunrua",
		);
		expect(screen.getByRole("link", { name: "RSS 订阅" }).getAttribute("href")).toBe(
			"/rss.xml",
		);
	});

	it("站点设置的页脚文案替换默认版权行", () => {
		settings.data = { footer_text: "My Blog 版权所有", site_url: "http://localhost:5173" };
		render(<Footer />);
		expect(screen.getByText("Violet 版权所有")).toBeTruthy();
		expect(screen.queryByText("localhost:5173")).toBeNull();
	});
});
