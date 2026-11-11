import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TweetCardImages } from "../TweetCardImages";

const openPreview = vi.hoisted(() => vi.fn());
vi.mock("@shared/ui/image-preview", () => ({
	useImagePreview: () => ({
		open: false,
		images: [],
		currentIndex: 0,
		triggerElement: null,
		openPreview,
		closePreview: vi.fn(),
		setCurrentIndex: vi.fn(),
	}),
	ImagePreview: () => null,
}));
afterEach(() => {
	cleanup();
	openPreview.mockClear();
});

describe("TweetCardImages", () => {
	it("所有配图进入灯箱，第四格使用真实缩略图飞入且不触发整卡导航", () => {
		const navigate = vi.fn();
		const images = Array.from({ length: 7 }, (_, index) => ({
			url: `/uploads/tweet/${index}.jpg`,
			width: 900,
			height: 600,
		}));
		render(
			<div onClick={navigate} onKeyDown={navigate}>
				<TweetCardImages images={images} />
			</div>,
		);
		expect(screen.getAllByRole("button")).toHaveLength(4);
		const fourth = screen.getByRole("button", { name: "查看第 4 张，共 7 张" });
		const thumbnail = fourth.querySelector("img");
		expect(thumbnail?.getAttribute("src")).toContain("w=400");
		fireEvent.click(screen.getByText("+4"));
		expect(navigate).not.toHaveBeenCalled();
		fireEvent.keyDown(fourth, { key: "Enter" });
		expect(navigate).not.toHaveBeenCalled();
		expect(openPreview).toHaveBeenCalledWith(
			images.map((image) => image.url),
			3,
			thumbnail,
			images.map(() => expect.stringContaining("w=400")),
		);
	});

	it("历史单图无尺寸仍保留真实图片，空集合没有空白容器", () => {
		const { rerender, container } = render(
			<TweetCardImages images={[{ url: "/legacy.jpg", width: null, height: null }]} />,
		);
		expect(
			screen.getByRole("button", { name: "查看第 1 张，共 1 张" }).querySelector("img"),
		).toBeInstanceOf(HTMLImageElement);
		rerender(<TweetCardImages images={[]} />);
		expect(container.firstChild).toBeNull();
	});
});
