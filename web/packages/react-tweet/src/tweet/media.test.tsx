import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { TweetPhoto } from "../data/media.ts";

import { EmbeddedTweet } from "../unstyled.ts";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function tweetWith(photos: TweetPhoto[]) {
	return {
		url: "https://x.com/jack/status/20",
		availability: "available" as const,
		snapshot: {
			author: { name: "Jack", handle: "jack" },
			text: "照片",
			media: photos,
		},
	};
}

const portrait = (name: string): TweetPhoto => ({
	kind: "photo",
	url: `/${name}.jpg`,
	width: 900,
	height: 2000,
});
const landscape = (name: string): TweetPhoto => ({
	kind: "photo",
	url: `/${name}.jpg`,
	width: 1600,
	height: 900,
});

it("照片网格不跨越视频合并，保留来源媒体的阅读顺序", () => {
	const { container } = render(
		<EmbeddedTweet
			tweet={{
				url: "https://x.com/jack/status/20",
				availability: "available",
				snapshot: {
					author: { name: "Jack", handle: "jack" },
					text: "按顺序阅读媒体",
					media: [
						{ kind: "photo", url: "/first.jpg" },
						{ kind: "video", url: "/middle.mp4" },
						{ kind: "photo", url: "/last.jpg" },
					],
				},
			}}
		/>,
	);
	expect(
		Array.from(container.querySelectorAll("img, video"), (media) => media.getAttribute("src")),
	).toEqual(["/first.jpg", "/middle.mp4", "/last.jpg"]);
});

it("竖图为主的多张照片用横向滚动条，每张保持各自的宽高比", () => {
	const { container } = render(
		<EmbeddedTweet
			tweet={tweetWith([
				portrait("a"),
				portrait("b"),
				{ ...portrait("c"), width: 1000, height: 1000 },
				portrait("d"),
			])}
		/>,
	);
	expect(container.querySelector(".v-tweet__photos")).toBeNull();
	const rail = screen.getByRole("group");
	expect(rail.getAttribute("aria-label")).toContain("4");
	const cards = Array.from(rail.querySelectorAll<HTMLElement>(".v-tweet__photo"));
	expect(cards).toHaveLength(4);
	expect(cards[0].style.getPropertyValue("--_photo-ratio")).toBe(String(900 / 2000));
	expect(cards[2].style.getPropertyValue("--_photo-ratio")).toBe("1");
	// 极端长图的宽高比被钳制，避免卡片窄到无法辨认。
	const extreme = render(
		<EmbeddedTweet tweet={tweetWith([{ ...portrait("x"), height: 9000 }, portrait("y")])} />,
	);
	expect(
		extreme.container
			.querySelector<HTMLElement>(".v-tweet__photo")
			?.style.getPropertyValue("--_photo-ratio"),
	).toBe("0.4");
});

it("横图为主、单张或缺少尺寸时保持方格或原比例，不使用滚动条", () => {
	for (const photos of [
		[landscape("a"), landscape("b"), landscape("c")],
		[portrait("a")],
		[portrait("a"), { kind: "photo" as const, url: "/no-size.jpg" }],
	]) {
		const { container, unmount } = render(<EmbeddedTweet tweet={tweetWith(photos)} />);
		expect(container.querySelector(".v-tweet__rail")).toBeNull();
		expect(container.querySelector(".v-tweet__photos")).not.toBeNull();
		unmount();
	}
});

it("滚动条的前后按钮只在对应方向还有内容时出现，点击按一张卡片的宽度加列间距滚动", () => {
	vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
	vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(180);
	const scrollBy = vi.fn();
	HTMLElement.prototype.scrollBy = scrollBy;
	render(<EmbeddedTweet tweet={tweetWith([portrait("a"), portrait("b"), portrait("c")])} />);
	const track = screen.getByRole("group");
	const next = screen.getByRole("button", { name: /下一组|Next/ });
	expect(screen.queryByRole("button", { name: /上一组|Previous/ })).toBeNull();

	fireEvent.click(next);
	expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 180 }));

	// 滚到中段：两个方向都可用；滚到末尾：只剩向前。
	track.scrollLeft = 300;
	fireEvent.scroll(track);
	expect(screen.getByRole("button", { name: /上一组|Previous/ })).not.toBeNull();
	expect(screen.getByRole("button", { name: /下一组|Next/ })).not.toBeNull();
	track.scrollLeft = 800;
	fireEvent.scroll(track);
	expect(screen.queryByRole("button", { name: /下一组|Next/ })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: /上一组|Previous/ }));
	expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -180 }));
});

it("onOpenPhoto 接管普通点击，修饰键点击仍按链接打开，renderPhotos 优先", () => {
	const open = vi.fn();
	const photos = [portrait("a"), portrait("b")];
	render(<EmbeddedTweet tweet={tweetWith(photos)} onOpenPhoto={open} />);
	const links = document.querySelectorAll<HTMLAnchorElement>("a.v-tweet__photo");
	expect(links).toHaveLength(2);

	const plain = fireEvent.click(links[1]);
	expect(plain).toBe(false);
	expect(open).toHaveBeenCalledTimes(1);
	const [group, index, trigger] = open.mock.calls[0];
	expect(group.map((photo: TweetPhoto) => photo.url)).toEqual(["/a.jpg", "/b.jpg"]);
	expect(index).toBe(1);
	expect(trigger).toBe(links[1]);

	expect(fireEvent.click(links[0], { ctrlKey: true })).toBe(true);
	expect(fireEvent.click(links[0], { metaKey: true })).toBe(true);
	expect(open).toHaveBeenCalledTimes(1);
});

it("同时提供 renderPhotos 时由它全权负责，onOpenPhoto 不会被调用", () => {
	const open = vi.fn();
	render(
		<EmbeddedTweet
			tweet={tweetWith([portrait("a"), portrait("b")])}
			renderPhotos={() => <button type="button">host</button>}
			onOpenPhoto={open}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "host" }));
	expect(open).not.toHaveBeenCalled();
	expect(document.querySelector(".v-tweet__rail")).toBeNull();
});
