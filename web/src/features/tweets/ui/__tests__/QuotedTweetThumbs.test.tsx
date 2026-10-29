/**
 * QuotedTweetThumbs：引用卡片的小拼图、+N 提示与灯箱联动。
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

import { QuotedTweetThumbs } from "../QuotedTweetThumbs";

const urls = ["a", "b", "c", "d", "e", "f"].map((n) => `/uploads/${n}.png`);
const refs = urls.map((url) => ({ url, width: null, height: null }));

describe("QuotedTweetThumbs", () => {
	afterEach(() => {
		cleanup();
		previewState.lastOpen = null;
	});

	it("没有图片时不渲染", () => {
		const { container } = render(<QuotedTweetThumbs images={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("最多 4 格，多出的以 +N 提示在最后一格", () => {
		const { container } = render(<QuotedTweetThumbs images={refs} />);
		expect(container.querySelector("[data-count]")?.getAttribute("data-count")).toBe("4");
		expect(container.querySelectorAll("button.v-tweet__photo")).toHaveLength(4);
		expect(screen.getByText("+2")).toBeTruthy();
	});

	it("点击缩略图以对应序号打开灯箱并带上全部图片，不冒泡到卡片", () => {
		const outer = vi.fn();
		render(
			// biome-ignore lint/a11y/useKeyWithClickEvents: 仅验证冒泡被阻止
			<div onClick={outer}>
				<QuotedTweetThumbs images={refs} />
			</div>,
		);
		fireEvent.click(screen.getByRole("button", { name: "查看第 3 张图片，共 6 张" }));
		const [images, index] = previewState.lastOpen as [string[], number];
		expect(images).toEqual(urls);
		expect(index).toBe(2);
		expect(outer).not.toHaveBeenCalled();
	});
});
