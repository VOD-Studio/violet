import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { createPortal } from "react-dom";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvailableTweet, TweetData, TweetPhoto, TweetVideo } from "../unstyled.ts";
import { EmbeddedTweet } from "../unstyled.ts";

function available(overrides: Partial<AvailableTweet["snapshot"]> = {}): AvailableTweet {
	return {
		id: "20",
		url: "https://x.com/jack/status/20",
		availability: "available",
		snapshot: { author: { name: "Jack", handle: "jack" }, text: "Native body", ...overrides },
	};
}

afterEach(cleanup);

describe("原生语义与不可用边界", () => {
	it("正文事件冒泡到宿主，链接交互保持独立", () => {
		const click = vi.fn();
		render(
			<EmbeddedTweet
				tweet={available()}
				onClick={click}
				messages={{ source: "Open source" }}
			/>,
		);
		fireEvent.click(screen.getByText("Native body"));
		expect(click).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole("link", { name: "Open source" }));
		expect(click).toHaveBeenCalledTimes(1);
	});

	it.each([
		"unavailable",
		"private",
		"deleted",
	] as const)("%s 不展示不可信输入中的残留正文、媒体与引用", (availability) => {
		const stale = {
			...available({ media: [{ kind: "photo", url: "https://images.example/secret.jpg" }] }),
			availability,
			quotedTweet: available({ text: "Secret quote" }),
		} as unknown as TweetData;
		const slot = vi.fn();
		const { container } = render(<EmbeddedTweet tweet={stale} renderPhotos={slot} />);
		expect(container.textContent).not.toContain("Native body");
		expect(container.textContent).not.toContain("Secret quote");
		expect(container.querySelector("img, video")).toBeNull();
		expect(slot).not.toHaveBeenCalled();
	});

	it("只展开一层引用，不把根 ref 或原生 id 复制到引用文章", () => {
		const root = available();
		root.quotedTweet = {
			...available({ text: "Quoted body" }),
			id: "21",
			url: "https://x.com/jack/status/21",
			quotedTweet: {
				...available({ text: "Deep secret" }),
				id: "22",
				url: "https://x.com/jack/status/22",
			},
		};
		const ref = createRef<HTMLElement>();
		const { container } = render(
			<EmbeddedTweet
				tweet={root}
				id="unique"
				ref={ref}
				messages={{ quote: "Deep source" }}
			/>,
		);
		expect(container.querySelectorAll("article")).toHaveLength(2);
		expect(container.querySelectorAll("#unique")).toHaveLength(1);
		expect(ref.current).toBe(container.firstElementChild);
		expect(screen.queryByText("Deep secret")).toBeNull();
		expect(screen.getByRole("link", { name: "Deep source" }).getAttribute("href")).toBe(
			"https://x.com/jack/status/22",
		);
	});
});

describe("不可信内容安全与媒体真实性", () => {
	it("危险协议、反斜杠、协议相对地址不会进入导航或媒体属性", () => {
		const tweet = available({
			author: {
				name: "<script>alert(1)</script>",
				handle: "invalid handle",
				url: "javascript:alert(1)",
				avatarUrl: "data:image/svg+xml,bad",
			},
			text: "Unsafe link",
			segments: [{ kind: "link", text: "Unsafe link", url: "javascript:alert(1)" }],
			media: [
				{ kind: "photo", url: "//evil.test/image.jpg" },
				{ kind: "video", url: "/\\evil.test/movie.mp4" },
			],
		});
		tweet.url = "javascript:alert(1)";
		tweet.id = undefined;
		const { container } = render(<EmbeddedTweet tweet={tweet} />);
		expect(container.querySelector("script, iframe, img, video, a")).toBeNull();
		expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
		expect(screen.getByText("Unsafe link")).toBeTruthy();
	});

	it("同源媒体保留相对路径，只把净化后且有真实来源的媒体传入扩展点", () => {
		const photos = vi.fn<(value: TweetPhoto[]) => null>().mockReturnValue(null);
		const video = vi.fn<(value: TweetVideo) => null>().mockReturnValue(null);
		render(
			<EmbeddedTweet
				tweet={available({
					media: [
						{
							kind: "photo",
							url: "/uploads/original.jpg",
							thumbnailUrl: "javascript:bad",
						},
						{ kind: "photo", url: "data:image/svg+xml,bad" },
						{
							kind: "video",
							url: "javascript:bad",
							thumbnailUrl: "/uploads/poster.jpg",
						},
					],
				})}
				renderPhotos={photos}
				renderVideo={video}
			/>,
		);
		expect(photos).toHaveBeenCalledWith([
			{ kind: "photo", url: "/uploads/original.jpg", thumbnailUrl: undefined },
		]);
		expect(video).toHaveBeenCalledWith({
			kind: "video",
			url: undefined,
			thumbnailUrl: "/uploads/poster.jpg",
		});
	});

	it("照片打开原图、视频使用播放源、仅封面不创建播放器，播放错误降级", () => {
		const { container } = render(
			<EmbeddedTweet
				tweet={available({
					media: [
						{
							kind: "photo",
							url: "/uploads/original.jpg",
							thumbnailUrl: "/uploads/thumb.jpg",
							alt: "Original image",
						},
						{
							kind: "video",
							url: "https://video.example/movie.mp4",
							thumbnailUrl: "/uploads/poster.jpg",
						},
						{ kind: "animated_gif", thumbnailUrl: "/uploads/gif-poster.jpg" },
					],
				})}
			/>,
		);
		const image = screen.getByAltText("Original image");
		expect(image.getAttribute("src")).toBe("/uploads/thumb.jpg");
		expect(image.closest("a")?.getAttribute("href")).toBe("/uploads/original.jpg");
		const player = container.querySelector("video");
		expect(container.querySelectorAll("video")).toHaveLength(1);
		expect(player?.getAttribute("src")).toBe("https://video.example/movie.mp4");
		fireEvent.error(player as HTMLVideoElement);
		expect(container.querySelector("video")).toBeNull();
		for (const source of ["/uploads/poster.jpg", "/uploads/gif-poster.jpg"]) {
			expect(
				container.querySelector(`img[src="${source}"]`)?.closest("a")?.getAttribute("href"),
			).toBe("https://x.com/jack/status/20");
		}
	});

	it("头像加载失败保留作者身份，换入新头像后允许重新加载", () => {
		const first = available({
			author: { name: "Jack", handle: "jack", avatarUrl: "/uploads/broken.jpg" },
		});
		const view = render(<EmbeddedTweet tweet={first} />);
		fireEvent.error(view.container.querySelector("img") as HTMLImageElement);
		expect(screen.getByText("Jack")).toBeTruthy();
		expect(screen.getByText("@jack")).toBeTruthy();
		expect(view.container.querySelector("img")).toBeNull();
		view.rerender(
			<EmbeddedTweet
				tweet={available({
					author: { ...first.snapshot.author, avatarUrl: "/uploads/new.jpg" },
				})}
			/>,
		);
		expect(view.container.querySelector("img")?.getAttribute("src")).toBe("/uploads/new.jpg");
	});

	it("照片 slot 的 portal 键盘事件可以到达 window", () => {
		const keyboard = vi.fn();
		window.addEventListener("keydown", keyboard);
		try {
			render(
				<EmbeddedTweet
					tweet={available({ media: [{ kind: "photo", url: "/uploads/photo.jpg" }] })}
					renderPhotos={() =>
						createPortal(<button type="button">Portal photo</button>, document.body)
					}
				/>,
			);
			fireEvent.keyDown(screen.getByRole("button", { name: "Portal photo" }), {
				key: "ArrowRight",
			});
			expect(keyboard).toHaveBeenCalledTimes(1);
		} finally {
			window.removeEventListener("keydown", keyboard);
		}
	});
});

describe("本地化与服务端渲染", () => {
	it("数字和时间采用显式 locale/timeZone，模板覆盖不改变来源正文与自由文本警告", () => {
		const tweet = available({
			publishedAt: "2024-01-01T00:00:00.000Z",
			metrics: { likes: 1200 },
			notices: ["poll"],
			warnings: ["Host warning"],
		});
		const { container } = render(
			<EmbeddedTweet
				tweet={tweet}
				locale="de-DE"
				timeZone="Asia/Shanghai"
				messages={{ likes: "Appreciations: {count}", poll: "Poll notice" }}
			/>,
		);
		expect(
			screen.getByText(`Appreciations: ${new Intl.NumberFormat("de-DE").format(1200)}`),
		).toBeTruthy();
		expect(container.querySelector("time")?.textContent).toContain("08:00");
		expect(screen.getByText("Native body")).toBeTruthy();
		expect(screen.getByText("Host warning")).toBeTruthy();
		expect(screen.getByText("Poll notice")).toBeTruthy();
	});

	it("旧日期和非法日期不伪造 datetime；错误语言和时区不会中断文章", () => {
		const view = render(
			<EmbeddedTweet
				tweet={available({ publishedAt: "2024年春" })}
				locale="invalid_locale"
				timeZone="Invalid/Zone"
			/>,
		);
		expect(screen.getByText("2024年春")).toBeTruthy();
		expect(view.container.querySelector("time")).toBeNull();
		view.rerender(<EmbeddedTweet tweet={available({ publishedAt: "2024-02-30T00:00:00Z" })} />);
		expect(view.container.querySelector("time")).toBeNull();
		view.rerender(
			<EmbeddedTweet
				tweet={available({ publishedAt: "2024-02-29T00:00:00Z" })}
				locale="invalid_locale"
				timeZone="Invalid/Zone"
			/>,
		);
		expect(view.container.querySelector("time")).not.toBeNull();
	});

	it.each([
		"2026-10-06T01:02:03.123456Z",
		"2026-10-06T01:02:03.123456789Z",
	])("高精度时间 %s 保留 datetime 并按配置时区显示", (publishedAt) => {
		const { container } = render(
			<EmbeddedTweet
				tweet={available({ publishedAt })}
				locale="zh-CN"
				timeZone="Asia/Shanghai"
			/>,
		);
		const time = container.querySelector("time");
		expect(time?.getAttribute("datetime")).toBe(publishedAt);
		expect(time?.textContent).toContain("09:02");
	});

	it("显式地区和时区在 SSR 后水合，不产生可恢复错误", async () => {
		const content = (
			<EmbeddedTweet
				tweet={available({ publishedAt: "2024-01-01T00:00:00Z", metrics: { likes: 1200 } })}
				locale="zh-CN"
				timeZone="Asia/Shanghai"
			/>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(content);
		document.body.append(container);
		const initial = container.innerHTML;
		const onRecoverableError = vi.fn();
		let root: Root;
		await act(async () => {
			root = hydrateRoot(container, content, { onRecoverableError });
		});
		expect(container.innerHTML).toBe(initial);
		expect(onRecoverableError).not.toHaveBeenCalled();
		await act(async () => root.unmount());
		container.remove();
	});
});
