/**
 * TweetDetailMedia：大图查看区的切换、键盘与灯箱联动。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const previewState = vi.hoisted(() => ({ lastOpen: null as null | unknown[] }));

vi.mock("@shared/ui/image-preview", () => ({
	useImagePreview: () => ({
		open: false,
		images: [],
		thumbnails: undefined,
		currentIndex: 0,
		triggerElement: null,
		openPreview: (...args: unknown[]) => {
			previewState.lastOpen = args;
		},
		closePreview: () => {},
		setCurrentIndex: () => {},
	}),
	ImagePreview: () => null,
}));

import { TweetDetailMedia } from "../TweetDetailMedia";

const urls = ["/uploads/a.png", "/uploads/b.png", "/uploads/c.png"];
const shown = () => screen.getByRole("img", { name: /推文图片 \d/ }).getAttribute("alt");

describe("TweetDetailMedia", () => {
	afterEach(() => {
		cleanup();
		previewState.lastOpen = null;
	});

	it("没有图片时不渲染", () => {
		const { container } = render(<TweetDetailMedia images={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("单张图片不显示切换控件与缩略图条", () => {
		render(<TweetDetailMedia images={[urls[0]]} />);
		expect(screen.queryByRole("button", { name: "下一张" })).toBeNull();
		expect(screen.queryByText(/ \/ /)).toBeNull();
		expect(shown()).toBe("推文图片 1");
	});

	it("多张图片：箭头与缩略图切换，循环，并显示计数", () => {
		render(<TweetDetailMedia images={urls} />);
		expect(screen.getByText("1 / 3")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "下一张" }));
		expect(shown()).toBe("推文图片 2");
		fireEvent.click(screen.getByRole("button", { name: "上一张" }));
		fireEvent.click(screen.getByRole("button", { name: "上一张" }));
		expect(shown()).toBe("推文图片 3");
		fireEvent.click(screen.getByRole("button", { name: "查看第 2 张图片" }));
		expect(shown()).toBe("推文图片 2");
		expect(
			screen.getByRole("button", { name: "查看第 2 张图片" }).getAttribute("aria-current"),
		).toBe("true");
	});

	it("方向键切换图片", () => {
		render(<TweetDetailMedia images={urls} />);
		const stage = screen.getByRole("group", { name: /推文图片，共 3 张/ });
		fireEvent.keyDown(stage, { key: "ArrowRight" });
		expect(shown()).toBe("推文图片 2");
		fireEvent.keyDown(stage, { key: "ArrowLeft" });
		fireEvent.keyDown(stage, { key: "ArrowLeft" });
		expect(shown()).toBe("推文图片 3");
	});

	it("点击大图以当前图片打开灯箱，并带上全部原图", () => {
		render(<TweetDetailMedia images={urls} />);
		fireEvent.click(screen.getByRole("button", { name: "下一张" }));
		fireEvent.click(screen.getByRole("button", { name: "放大查看第 2 张图片" }));
		const [images, index] = previewState.lastOpen as [string[], number];
		expect(images).toEqual(urls);
		expect(index).toBe(1);
	});
});
