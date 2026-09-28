import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExternalTweet } from "../../model/types";
import { ExternalTweetCard } from "../ExternalTweetCard";

const preview = vi.hoisted(() => ({ portal: false }));

vi.mock("@shared/ui/image-grid", () => ({
	ImageGrid: ({ images }: { images: { url: string }[] }) => (
		<>
			<button type="button">预览 {images[0].url}</button>
			{preview.portal &&
				createPortal(
					<div role="dialog" tabIndex={-1}>
						图片灯箱
					</div>,
					document.body,
				)}
		</>
	),
}));

function externalFixture(overrides: Partial<ExternalTweet> = {}): ExternalTweet {
	return {
		id: "source-1",
		source_id: "9999999999999999999",
		canonical_url: "https://x.com/jack/status/9999999999999999999",
		snapshot_version: "v1",
		availability: "available",
		snapshot: {
			author: {
				id: "12",
				name: "Jack",
				handle: "jack",
				url: "https://x.com/jack",
				avatar_url: "",
			},
			text: "中文 😀 [doge] #标签",
			segments: [
				{ kind: "text", text: "中文 😀 [doge] " },
				{ kind: "hashtag", text: "#标签", url: "https://x.com/hashtag/标签" },
			],
			published_at: "2020-01-01T12:00:00Z",
			completeness: "complete",
			media: [
				{
					kind: "photo",
					url: "/uploads/external-tweets/photo.png",
					thumbnail_url: "",
					width: 100,
					height: 100,
					alt: "配图",
					file_id: "image1",
				},
			],
			warnings: [],
		},
		...overrides,
	};
}

afterEach(() => {
	cleanup();
	preview.portal = false;
});

describe("ExternalTweetCard", () => {
	it("展示来源身份、时间与保存到本站的媒体，保留表情文本", () => {
		render(<ExternalTweetCard tweet={externalFixture()} />);
		expect(screen.getByText("Jack")).toBeTruthy();
		expect(screen.getByText("@jack")).toBeTruthy();
		expect(screen.getByText(/中文 😀 \[doge\]/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "#标签" }).getAttribute("href")).toContain(
			"https://x.com/hashtag/",
		);
		expect(
			screen.getByRole("button", { name: "预览 /uploads/external-tweets/photo.png" }),
		).toBeTruthy();
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("正文点击交给本站卡片，链接与图片的点击和键盘事件独立", () => {
		const navigate = vi.fn();
		const key = vi.fn();
		render(
			<div role="button" tabIndex={0} onClick={navigate} onKeyDown={key}>
				<ExternalTweetCard tweet={externalFixture()} />
			</div>,
		);
		fireEvent.click(screen.getByText(/中文 😀/));
		expect(navigate).toHaveBeenCalledTimes(1);
		const original = screen.getByRole("link", { name: "在 X 查看原文" });
		fireEvent.click(original);
		fireEvent.keyDown(original, { key: "Enter" });
		fireEvent.click(screen.getByRole("button", { name: /预览/ }));
		fireEvent.keyDown(screen.getByRole("button", { name: /预览/ }), { key: " " });
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(key).not.toHaveBeenCalled();
	});

	it("不可用时隐藏任何残留正文和媒体，不把暂不可用称作删除", () => {
		render(<ExternalTweetCard tweet={externalFixture({ availability: "unavailable" })} />);
		expect(screen.getByText("原文暂不可用")).toBeTruthy();
		expect(screen.queryByText("Jack")).toBeNull();
		expect(screen.queryByText(/中文 😀/)).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByRole("link", { name: "在 X 查看原文" })).toBeTruthy();
	});

	it("Portal 内的灯箱按键能够到达 window，卡片内图片按键仍独立", () => {
		preview.portal = true;
		const keyboard = vi.fn();
		window.addEventListener("keydown", keyboard);
		try {
			render(<ExternalTweetCard tweet={externalFixture()} />);
			fireEvent.keyDown(screen.getByRole("button", { name: /预览/ }), { key: "Enter" });
			expect(keyboard).not.toHaveBeenCalled();
			fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
			fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
			expect(keyboard).toHaveBeenCalledTimes(2);
		} finally {
			window.removeEventListener("keydown", keyboard);
		}
	});

	it("只展开一层引用，视频只显示本站封面和 X 跳转", () => {
		const fixture = externalFixture();
		const quoted = externalFixture({
			id: "source2",
			quoted_tweet: externalFixture({ id: "source3" }),
		});
		fixture.quoted_tweet = quoted;
		if (!fixture.snapshot) throw new Error("fixture has no snapshot");
		fixture.snapshot.media = [
			{
				kind: "video",
				url: "/uploads/poster.png",
				thumbnail_url: "",
				width: 100,
				height: 100,
				alt: "视频封面",
				file_id: "video1",
			},
		];
		render(<ExternalTweetCard tweet={fixture} />);
		expect(screen.getAllByLabelText("X 原文")).toHaveLength(2);
		expect(screen.getByRole("img", { name: "视频封面" }).getAttribute("src")).toBe(
			"/uploads/poster.png",
		);
		expect(screen.getByRole("link", { name: /视频 · 在 X 查看/ })).toBeTruthy();
	});
});
