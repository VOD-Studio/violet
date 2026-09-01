import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaViewer, type MediaViewerItem } from "./index";

const { filePreviewProps, modalProps } = vi.hoisted(() => ({
	filePreviewProps: vi.fn(),
	modalProps: vi.fn(),
}));

vi.mock("@shared/ui/modal", () => ({
	Modal: (props: {
		children: ReactNode;
		open: boolean;
		title?: ReactNode;
		className?: string;
	}) => {
		modalProps(props);
		return props.open ? (
			<div
				role="dialog"
				aria-label={typeof props.title === "string" ? props.title : undefined}
			>
				{props.children}
			</div>
		) : null;
	},
}));

vi.mock("@shared/ui/file-preview", () => ({
	FilePreview: (props: {
		mimeType: string;
		name?: string;
		variant?: string;
		onImageClick?: (url: string, trigger?: HTMLElement | null, thumbnail?: string) => void;
		url: string;
		thumbnailUrl?: string;
	}) => {
		filePreviewProps(props);
		return (
			<button
				type="button"
				onClick={(event) =>
					props.onImageClick?.(props.url, event.currentTarget, props.thumbnailUrl)
				}
			>
				预览 {props.mimeType}
			</button>
		);
	},
}));

vi.mock("@shared/ui/image-preview", () => ({
	ImagePreview: ({ onClose, open }: { onClose: () => void; open: boolean }) => (
		<div data-testid="image-fullscreen" data-open={open}>
			<button type="button" onClick={onClose}>
				关闭图片全屏
			</button>
		</div>
	),
}));

const items: MediaViewerItem[] = [
	{
		id: "image",
		url: "/image.jpg",
		thumbnailUrl: "/image-thumb.jpg",
		mimeType: "image/jpeg",
		name: "night-train.jpg",
		size: 1_536,
	},
	{
		id: "video",
		url: "/video.mp4",
		mimeType: "video/mp4",
		name: "station.mp4",
	},
	{
		id: "audio",
		url: "/audio.mp3",
		mimeType: "audio/mpeg",
		name: "platform.mp3",
	},
	{
		id: "document",
		url: "/notes.pdf",
		mimeType: "application/pdf",
		name: "field-notes.pdf",
	},
];

describe("MediaViewer", () => {
	beforeEach(() => {
		filePreviewProps.mockReset();
		modalProps.mockReset();
	});

	it("用单一 chrome 展示文件信息、计数、导航、下载与关闭", () => {
		const onIndexChange = vi.fn();
		const onOpenChange = vi.fn();
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={onOpenChange}
				items={items}
				index={0}
				onIndexChange={onIndexChange}
			/>,
		);

		expect(screen.getByText("night-train.jpg")).toBeTruthy();
		expect(screen.getByText("image/jpeg · 1.5 KB")).toBeTruthy();
		expect(screen.getByText("1 / 4")).toBeTruthy();
		expect((screen.getByRole("button", { name: "上一个" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		fireEvent.click(screen.getByRole("button", { name: "下一个" }));
		expect(onIndexChange).toHaveBeenCalledWith(1);
		const download = screen.getByRole("link", { name: "下载 night-train.jpg" });
		expect(download.getAttribute("href")).toBe("/image.jpg");
		expect(download.getAttribute("download")).toBe("night-train.jpg");
		fireEvent.click(screen.getByRole("button", { name: "关闭查看器" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);

		rerender(
			<MediaViewer
				open
				onOpenChange={onOpenChange}
				items={items}
				index={3}
				onIndexChange={onIndexChange}
			/>,
		);
		expect((screen.getByRole("button", { name: "下一个" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("通过 FilePreview viewer variant 分发多种 MIME", () => {
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={() => {}}
			/>,
		);
		for (const index of [1, 2, 3]) {
			rerender(
				<MediaViewer
					open
					onOpenChange={() => {}}
					items={items}
					index={index}
					onIndexChange={() => {}}
				/>,
			);
		}

		expect(filePreviewProps.mock.calls.map(([props]) => props.mimeType)).toEqual([
			"image/jpeg",
			"video/mp4",
			"audio/mpeg",
			"application/pdf",
		]);
		expect(filePreviewProps.mock.calls.every(([props]) => props.variant === "viewer")).toBe(
			true,
		);
	});

	it("只为非视频和非音频格式处理左右方向键", () => {
		const onIndexChange = vi.fn();
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={onIndexChange}
			/>,
		);
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(onIndexChange).toHaveBeenLastCalledWith(1);

		onIndexChange.mockClear();
		rerender(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={1}
				onIndexChange={onIndexChange}
			/>,
		);
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(onIndexChange).not.toHaveBeenCalled();

		rerender(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={2}
				onIndexChange={onIndexChange}
			/>,
		);
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		expect(onIndexChange).not.toHaveBeenCalled();
	});

	it("图片全屏打开关闭时外层 dialog 保持同一节点", () => {
		render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={() => {}}
			/>,
		);
		const dialog = screen.getByRole("dialog");

		fireEvent.click(screen.getByRole("button", { name: "预览 image/jpeg" }));
		expect(screen.getByTestId("image-fullscreen")).toBeTruthy();
		expect(screen.getByRole("dialog")).toBe(dialog);
		fireEvent.click(screen.getByRole("button", { name: "关闭图片全屏" }));
		expect(screen.getByRole("dialog")).toBe(dialog);
	});

	it("关闭后把焦点还给 triggerElement", async () => {
		const trigger = document.createElement("button");
		trigger.textContent = "打开素材";
		document.body.append(trigger);
		trigger.focus();
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={() => {}}
				triggerElement={trigger}
			/>,
		);
		document.body.focus();

		rerender(
			<MediaViewer
				open={false}
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={() => {}}
				triggerElement={null}
			/>,
		);

		await waitFor(() => expect(document.activeElement).toBe(trigger));
		trigger.remove();
	});

	it("空 items 不渲染，越界 index 收敛到最近的有效项", () => {
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={[]}
				index={9}
				onIndexChange={() => {}}
			/>,
		);
		expect(screen.queryByRole("dialog")).toBeNull();

		rerender(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={99}
				onIndexChange={() => {}}
			/>,
		);
		expect(screen.getByText("field-notes.pdf")).toBeTruthy();
		expect((screen.getByRole("button", { name: "下一个" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("切换媒体类型时保持同一个查看器尺寸", () => {
		const { rerender } = render(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={0}
				onIndexChange={() => {}}
			/>,
		);
		const imageClassName = modalProps.mock.lastCall?.[0].className as string;

		rerender(
			<MediaViewer
				open
				onOpenChange={() => {}}
				items={items}
				index={1}
				onIndexChange={() => {}}
			/>,
		);
		const videoClassName = modalProps.mock.lastCall?.[0].className as string;
		expect(videoClassName).toBe(imageClassName);
		expect(videoClassName).toContain("h-[min(88dvh,48rem)]");
		expect(videoClassName).toContain("sm:max-w-[min(94vw,72rem)]");
	});
});
