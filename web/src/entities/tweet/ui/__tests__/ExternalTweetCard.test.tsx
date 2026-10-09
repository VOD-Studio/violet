import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExternalTweet } from "../../model/types";
import { ExternalTweetCard } from "../ExternalTweetCard";

const preview = vi.hoisted(() => ({ portal: false, openPreview: vi.fn() }));

vi.mock("@shared/ui/image-preview", () => ({
	useImagePreview: () => ({
		open: false,
		images: [],
		thumbnails: undefined,
		currentIndex: 0,
		triggerElement: null,
		openPreview: preview.openPreview,
		closePreview: vi.fn(),
		setCurrentIndex: vi.fn(),
	}),
	ImagePreview: () =>
		preview.portal
			? createPortal(
					<div role="dialog" tabIndex={-1}>
						图片灯箱
					</div>,
					document.body,
				)
			: null,
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
	preview.openPreview.mockClear();
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
		const photo = screen.getByRole("link", { name: "查看图片 1 原图" });
		expect(photo.getAttribute("href")).toBe("/uploads/external-tweets/photo.png");
		expect(screen.getByRole("img", { name: "配图" })).toBeTruthy();
	});

	it("点击图片交给本站灯箱，带上整组原图、序号与触发元素", () => {
		const fixture = externalFixture();
		if (!fixture.snapshot) throw new Error("fixture has no snapshot");
		fixture.snapshot.media = ["a", "b", "c", "d"].map((name) => ({
			kind: "photo" as const,
			url: `/uploads/${name}.png`,
			thumbnail_url: `/uploads/${name}-small.png`,
			width: 900,
			height: 2000,
			alt: name,
			file_id: name,
		}));
		render(<ExternalTweetCard tweet={fixture} />);
		const second = screen.getByRole("link", { name: "查看图片 2 原图" });
		fireEvent.click(second);
		expect(preview.openPreview).toHaveBeenCalledWith(
			["/uploads/a.png", "/uploads/b.png", "/uploads/c.png", "/uploads/d.png"],
			1,
			second,
			[
				"/uploads/a-small.png",
				"/uploads/b-small.png",
				"/uploads/c-small.png",
				"/uploads/d-small.png",
			],
		);
	});

	it("竖图为主的多张图片用横向滚动条展示，与 X 原帖一致", () => {
		const fixture = externalFixture();
		if (!fixture.snapshot) throw new Error("fixture has no snapshot");
		fixture.snapshot.media = ["a", "b", "c", "d"].map((name) => ({
			kind: "photo" as const,
			url: `/uploads/${name}.png`,
			thumbnail_url: "",
			width: 900,
			height: 2000,
			alt: name,
			file_id: name,
		}));
		const { container } = render(<ExternalTweetCard tweet={fixture} />);
		expect(container.querySelector(".v-tweet__rail")).not.toBeNull();
		expect(container.querySelector(".v-tweet__photos")).toBeNull();
		expect(container.querySelectorAll(".v-tweet__photo")).toHaveLength(4);
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
		const photo = screen.getByRole("link", { name: /原图/ });
		fireEvent.click(photo);
		fireEvent.keyDown(photo, { key: " " });
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(key).not.toHaveBeenCalled();
	});

	it("不可用时保留原文入口且隐藏残留正文和媒体", () => {
		render(<ExternalTweetCard tweet={externalFixture({ availability: "unavailable" })} />);
		expect(screen.queryByText("Jack")).toBeNull();
		expect(screen.queryByText(/中文 😀/)).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.queryByRole("link", { name: /原图/ })).toBeNull();
		expect(screen.getByRole("link", { name: "在 X 查看原文" })).toBeTruthy();
	});

	it("Portal 内的灯箱按键能够到达 window，卡片内图片按键仍独立", () => {
		preview.portal = true;
		const keyboard = vi.fn();
		window.addEventListener("keydown", keyboard);
		try {
			render(<ExternalTweetCard tweet={externalFixture()} />);
			fireEvent.keyDown(screen.getByRole("link", { name: /原图/ }), { key: "Enter" });
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
		const { container } = render(<ExternalTweetCard tweet={fixture} />);
		expect(screen.getAllByRole("article")).toHaveLength(2);
		expect(screen.getByRole("img", { name: "视频封面" }).getAttribute("src")).toBe(
			"/uploads/poster.png",
		);
		expect(
			screen.getByRole("img", { name: "视频封面" }).closest("a")?.getAttribute("href"),
		).toBe(fixture.canonical_url);
		expect(container.querySelector("video")).toBeNull();
	});
});
