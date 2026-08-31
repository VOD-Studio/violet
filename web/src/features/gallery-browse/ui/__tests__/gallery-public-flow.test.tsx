import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { detailQuery, feedQuery, photoStackProps } = vi.hoisted(() => ({
	detailQuery: {
		data: undefined as
			| {
					id: string;
					slug: string;
					title: string;
					summary: string;
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
	photoStackProps: vi.fn(),
}));

vi.mock("@entities/gallery/api/queries", () => ({
	usePublishedGalleryFeed: () => feedQuery,
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
}));

vi.mock("@shared/ui/photo-stack", () => ({
	PhotoStack: (props: { images: Array<{ src: string; alt?: string }>; footer?: ReactNode }) => {
		photoStackProps(props);
		return (
			<div>
				<span>PhotoStack {props.images.length}</span>
				{props.footer}
			</div>
		);
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
	published_at: "2026-08-31T00:00:00Z",
	items,
};

describe("公开图集用户流", () => {
	beforeEach(() => {
		photoStackProps.mockReset();
		feedQuery.galleries = [];
		feedQuery.isLoading = false;
		feedQuery.isError = false;
		feedQuery.hasMore = false;
		feedQuery.loadingMore = false;
		feedQuery.loadMoreFailed = false;
		feedQuery.loadMore.mockReset();
		detailQuery.data = undefined;
		detailQuery.isLoading = false;
		detailQuery.isError = false;
	});

	it("列表把全部图片的缩略图按顺序交给 PhotoStack", () => {
		feedQuery.galleries = [gallery];
		render(<GalleryBrowsePage />);

		expect(screen.getByText("PhotoStack 6")).toBeTruthy();
		expect(photoStackProps).toHaveBeenCalledWith(
			expect.objectContaining({
				images: items.map((item) => ({ src: item.thumbnail, alt: item.alt_text })),
				loading: "lazy",
			}),
		);
		expect(screen.getByRole("link", { name: "夏日微光" }).getAttribute("href")).toBe(
			"/galleries/summer-light",
		);
	});

	it("详情按 position 展示全部原图、替代文本与说明", () => {
		detailQuery.data = {
			...gallery,
			items: [items[2], items[0], items[1], ...items.slice(3)],
		};
		render(<GalleryDetailPage slug="summer-light" />);

		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(6);
		expect(images.map((image) => image.getAttribute("src"))).toEqual(
			items.map((item) => item.url),
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
