import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { detailQuery, feedQuery, imagePreviewProps, summaryQuery } = vi.hoisted(() => ({
	detailQuery: {
		data: undefined as
			| {
					id: string;
					slug: string;
					title: string;
					summary: string;
					location: string;
					published_at: string;
					items: Array<{
						file_id: string;
						position: number;
						thumbnail: string;
						url: string;
						width: number;
						height: number;
						alt_text: string;
						caption: string;
					}>;
			  }
			| undefined,
		isLoading: false,
		isError: false,
	},
	feedQuery: {
		galleries: [] as Array<Record<string, unknown>>,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
		hasMore: false,
		loadingMore: false,
		loadMoreFailed: false,
		loadMore: vi.fn(),
	},
	imagePreviewProps: vi.fn(),
	summaryQuery: {
		data: { album_count: 7, image_count: 112 } as
			| { album_count: number; image_count: number }
			| undefined,
		isError: false,
		refetch: vi.fn(),
	},
}));

vi.mock("@entities/gallery/api/queries", () => ({
	usePublishedGalleryFeed: () => feedQuery,
	usePublishedGallerySummary: () => summaryQuery,
	usePublishedGallery: () => detailQuery,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		to,
		...props
	}: {
		children: ReactNode;
		params?: { slug: string };
		to: string;
	}) => (
		<a href={params ? to.replace("$slug", params.slug) : to} {...props}>
			{children}
		</a>
	),
	useRouter: () => ({
		history: { back: vi.fn() },
		navigate: vi.fn(),
	}),
}));

vi.mock("@shared/ui/image-preview", () => ({
	// 灯箱交互由 image-preview 自己的组件测试覆盖，这里只验证 DTO 到 props 的映射
	ImagePreview: (props: { images: string[] }) => {
		imagePreviewProps(props);
		return null;
	},
}));

import { GalleryBrowsePage } from "../GalleryBrowsePage";
import { GalleryDetailPage } from "../GalleryDetailPage";

const items = Array.from({ length: 6 }, (_, index) => ({
	file_id: `file-${index}`,
	position: index,
	thumbnail: `/thumb-${index}.jpg`,
	url: `/original-${index}.jpg`,
	width: 1200,
	height: 800,
	alt_text: `替代文本 ${index}`,
	caption: `说明 ${index}`,
}));

const gallery = {
	id: "gallery-1",
	slug: "summer-light",
	title: "夏日微光",
	summary: "六张照片组成的图集",
	location: "新疆",
	published_at: "2026-08-31T00:00:00Z",
	items,
};

describe("公开图集用户流", () => {
	beforeEach(() => {
		imagePreviewProps.mockReset();
		feedQuery.galleries = [];
		feedQuery.isLoading = false;
		feedQuery.isError = false;
		feedQuery.hasMore = false;
		feedQuery.loadingMore = false;
		feedQuery.loadMoreFailed = false;
		feedQuery.loadMore.mockReset();
		summaryQuery.data = { album_count: 7, image_count: 112 };
		summaryQuery.isError = false;
		summaryQuery.refetch.mockReset();
		detailQuery.data = undefined;
		detailQuery.isLoading = false;
		detailQuery.isError = false;
	});

	it("精选最多三张真实图片共用一个相册链接，总数不取当前页长度", () => {
		feedQuery.galleries = [gallery];
		render(<GalleryBrowsePage />);
		const album = screen.getByRole("link", { name: "查看相册：夏日微光" });
		expect(album.getAttribute("href")).toBe("/galleries/summer-light");
		expect(
			within(album)
				.getAllByRole("img")
				.map((image) => image.getAttribute("alt")),
		).toEqual(items.slice(0, 3).map((item) => item.alt_text));
		expect(within(album).getByText("新疆")).toBeTruthy();
		expect(within(album).getByText("看全部")).toBeTruthy();
		expect(album.querySelector("button, a")).toBeNull();
		expect(screen.getByText(/个相册/).textContent).toBe("7 个相册 · 112 张");
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it.each([1, 2, 3])("只有 %i 张图时不补图或重复首图", (count) => {
		feedQuery.galleries = [{ ...gallery, items: items.slice(0, count) }];
		render(<GalleryBrowsePage />);
		expect(screen.getAllByRole("img")).toHaveLength(count);
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it("其余相册使用独立封面链接，精选不再出现在网格", () => {
		feedQuery.galleries = [
			gallery,
			{ ...gallery, id: "gallery-2", slug: "old-street", title: "旧街", location: "" },
		];
		render(<GalleryBrowsePage />);
		expect(screen.getAllByRole("link")).toHaveLength(2);
		expect(
			within(screen.getByRole("link", { name: "查看相册：旧街" })).getAllByRole("img"),
		).toHaveLength(1);
		expect(screen.getAllByRole("heading", { name: "夏日微光" })).toHaveLength(1);
	});

	it("坏图保留图片替代文本和相册入口", () => {
		feedQuery.galleries = [gallery];
		render(<GalleryBrowsePage />);
		fireEvent.error(screen.getAllByRole("img")[0]);
		expect(screen.getByRole("img", { name: items[0].alt_text }).textContent).toBe(
			"图片暂时无法显示",
		);
		expect(screen.getByRole("link", { name: "查看相册：夏日微光" })).toBeTruthy();
	});

	it("没有公开相册时不显示精选或伪造封面", () => {
		summaryQuery.data = { album_count: 0, image_count: 0 };
		render(<GalleryBrowsePage />);
		expect(screen.getByText("暂无图集")).toBeTruthy();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByRole("img")).toBeNull();
		expect(screen.getByText(/个相册/).textContent).toBe("0 个相册 · 0 张");
	});

	it("总数请求失败仍保留相册并可单独重试", () => {
		feedQuery.galleries = [gallery];
		summaryQuery.data = undefined;
		summaryQuery.isError = true;
		render(<GalleryBrowsePage />);
		expect(screen.getByRole("link", { name: "查看相册：夏日微光" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "重试总数" }));
		expect(summaryQuery.refetch).toHaveBeenCalledTimes(1);
	});

	it("详情按 position 展示图片、替代文本与说明", () => {
		detailQuery.data = {
			...gallery,
			items: [items[2], items[0], items[1], ...items.slice(3)],
		};
		render(<GalleryDetailPage slug="summer-light" />);

		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(6);
		expect(images.map((image) => image.getAttribute("alt"))).toEqual(
			items.map((item) => item.alt_text),
		);
		expect(images[0]?.getAttribute("loading")).toBe("eager");
		expect(images[0]?.getAttribute("fetchpriority")).toBe("high");
		expect(images.slice(1).every((image) => image.getAttribute("loading") === "lazy")).toBe(
			true,
		);
		for (const item of items) {
			expect(screen.getByText(item.caption)).toBeTruthy();
		}
	});

	it("点击图片打开灯箱并映射原图序列、缩略占位与逐图替代文本", () => {
		detailQuery.data = gallery;
		render(<GalleryDetailPage slug="summer-light" />);

		const triggers = screen.getAllByRole("button", { name: /替代文本/ });
		expect(triggers).toHaveLength(6);
		fireEvent.click(triggers[2]);

		expect(imagePreviewProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				open: true,
				currentIndex: 2,
				images: items.map((item) => item.url),
				thumbnails: items.map((item) => item.thumbnail),
				alts: items.map((item) => item.alt_text),
				triggerElement: triggers[2],
			}),
		);
	});

	it("灯箱内切换图片会同步索引", async () => {
		detailQuery.data = gallery;
		render(<GalleryDetailPage slug="summer-light" />);

		fireEvent.click(screen.getAllByRole("button", { name: /替代文本/ })[0]);
		const lastCall = imagePreviewProps.mock.calls.at(-1)?.[0] as {
			onIndexChange: (index: number) => void;
		};
		await act(async () => {
			lastCall.onIndexChange(4);
		});

		expect(imagePreviewProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ currentIndex: 4 }),
		);
	});

	it("下一页失败后保留重试入口", async () => {
		feedQuery.galleries = [gallery];
		feedQuery.hasMore = true;
		feedQuery.loadMoreFailed = true;
		render(<GalleryBrowsePage />);

		expect((await screen.findByRole("alert")).textContent).toBe("加载下一页失败，请重试");
		fireEvent.click(screen.getByRole("button", { name: "重试加载" }));

		expect(feedQuery.loadMore).toHaveBeenCalledTimes(1);
	});
});
