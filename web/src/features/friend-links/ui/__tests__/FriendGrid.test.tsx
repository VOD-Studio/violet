import { copyText } from "@shared/lib/clipboard";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FriendLinkPublicDTO } from "../../model/types";
import { ExchangeIdentity } from "../ExchangeIdentity";
import { FriendGrid } from "../FriendGrid";

vi.mock("@shared/lib/clipboard", () => ({ copyText: vi.fn() }));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const link: FriendLinkPublicDTO = {
	id: "friend",
	name: "朋友",
	url: "https://friend.example",
	avatar_url: "",
	description: "写一些文字",
	owner_name: "",
	sort_order: 0,
	rss_url: "https://friend.example/feed",
	feed_status: "error",
	site_status: "down",
	checked_at: "2026-11-18T12:00:00Z",
	latest_title: "上次成功的文章",
	latest_url: "https://friend.example/article",
	latest_published_at: "2026-11-01T12:00:00Z",
};

describe("友链快照展示", () => {
	it("站点和文章各有真实链接，失败不替换文章日期", () => {
		render(<FriendGrid links={[link]} />);
		expect(screen.getByRole("link", { name: "朋友" }).getAttribute("href")).toBe(link.url);
		expect(screen.getByRole("link", { name: "上次成功的文章" }).getAttribute("href")).toBe(
			link.latest_url,
		);
		expect(screen.getByText("RSS 抓取失败")).toBeTruthy();
		expect(screen.getByText("站点暂不可达")).toBeTruthy();
		expect(document.querySelector("time")?.getAttribute("datetime")).toBe(
			link.latest_published_at,
		);
	});

	it("未配置、等待抓取与成功空源保持不同文案", () => {
		render(
			<FriendGrid
				links={(["no_feed", "pending", "empty"] as const).map((status, index) => ({
					...link,
					id: String(index),
					feed_status: status,
					site_status: "up",
					latest_title: "",
					latest_url: "",
					latest_published_at: null,
				}))}
			/>,
		);
		for (const label of ["未提供 RSS", "等待更新", "暂无文章"])
			expect(screen.getByText(label)).toBeTruthy();
		expect(document.querySelector("time")).toBeNull();
	});
});

it("逐项复制真实服务端设置和绝对头像地址，失败也有可读反馈", async () => {
	vi.mocked(copyText).mockResolvedValue(true);
	render(
		<ExchangeIdentity
			settings={{
				site_name: "真实站名",
				site_url: "https://site.example",
				avatar_url: "/uploads/site.webp",
				bio: "真实简介",
			}}
		/>,
	);
	for (const [label, value] of [
		["名称", "真实站名"],
		["地址", "https://site.example"],
		["头像", "https://site.example/uploads/site.webp"],
		["简介", "真实简介"],
	]) {
		fireEvent.click(screen.getByRole("button", { name: `复制${label}` }));
		await screen.findByText(`已复制${label}`);
		expect(copyText).toHaveBeenLastCalledWith(value);
	}
	vi.mocked(copyText).mockResolvedValueOnce(false);
	fireEvent.click(screen.getByRole("button", { name: "复制名称" }));
	await screen.findByText("复制名称失败，请选中文字复制");
});
