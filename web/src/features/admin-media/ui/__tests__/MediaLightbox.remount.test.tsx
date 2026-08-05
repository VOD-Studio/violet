/**
 * MediaLightbox 全屏预览期间 Dialog 稳定性回归测试。
 *
 * 回归背景:打开/关闭全屏图片预览时,MediaLightbox 切换 Modal 的 modal prop,
 * 而 Radix Dialog 内部按 modal 分别渲染 DialogContentModal/DialogContentNonModal
 * 两个不同组件——prop 变化即整棵 Dialog 子树卸载重挂载:
 * 1) Dialog 内容的进场动画(缩放+淡入)重新播放一次;
 * 2) ContentImage 的 decoded 状态丢失,图片重新预载闪烁。
 * 修复:modal 保持恒定 true,不再随全屏开关切换。
 */
import type { MediaFile } from "@entities/media/model/types";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLightbox } from "../MediaLightbox";

// ContentImage 预载与 ImagePreview 比例探测都走 new Image(),jsdom 中让其立即成功
class MockImage {
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	naturalWidth = 1920;
	naturalHeight = 1080;
	#src = "";

	set src(value: string) {
		this.#src = value;
		queueMicrotask(() => this.onload?.());
	}

	get src() {
		return this.#src;
	}
}

const imageFile: MediaFile = {
	id: "f1",
	owner_id: "u1",
	purpose: "material",
	original_name: "photo.jpg",
	url: "/uploads/material/photo.jpg",
	size: 1024,
	mime_type: "image/jpeg",
	thumbnail: "/uploads/material/photo_thumb.jpg",
	status: "active",
	created_at: "2026-01-01T00:00:00Z",
};

function renderLightbox() {
	const onOpenChange = vi.fn();
	render(
		<MediaLightbox
			open
			onOpenChange={onOpenChange}
			files={[imageFile]}
			index={0}
			onIndexChange={() => {}}
		/>,
	);
	return { onOpenChange };
}

/** 等 ContentImage 预载完成并点击「点击全屏预览」,返回全屏层根节点 */
async function openFullscreen() {
	const zoomButton = await waitFor(
		() => {
			const el = document.querySelector("[title='点击全屏预览']");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		},
		{ timeout: 3000 },
	);
	fireEvent.click(zoomButton);
	return waitFor(
		() => {
			const el = document.querySelector("[class*='z-9999']");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		},
		{ timeout: 3000 },
	);
}

/** 等全屏层退出动画结束、完全卸载 */
async function waitFullscreenGone() {
	await waitFor(
		() => {
			expect(document.querySelector("[class*='z-9999']")).toBeNull();
		},
		{ timeout: 3000 },
	);
}

describe("MediaLightbox 全屏预览期间 Dialog 稳定性", () => {
	const originalImage = global.Image;

	beforeEach(() => {
		vi.stubGlobal("Image", MockImage as unknown as typeof Image);
	});

	afterEach(() => {
		cleanup(); // 无全局自动 cleanup,portal 残留会串扰后续用例
		vi.stubGlobal("Image", originalImage);
	});

	it("打开全屏图片预览不应导致 Dialog Content 重挂载(动画重播/图片重载)", async () => {
		renderLightbox();

		const dialogBefore = await waitFor(() => {
			const el = document.querySelector("[role=dialog]");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});

		await openFullscreen();

		// 关键断言:Dialog Content 仍是同一个 DOM 元素(未因 modal 切换重挂载)
		const dialogAfter = document.querySelector("[role=dialog]");
		expect(dialogAfter).toBe(dialogBefore);
	});

	it("ContentImage 已预载原图,全屏盒应直接按原图 natural 尺寸(不先大后小)", async () => {
		renderLightbox();

		// ContentImage 预载完成后按钮内的 <img> 显示的即是原图,
		// 模拟真实浏览器读出 natural 尺寸 400x300(小于视口盒)
		const zoomButton = (await waitFor(() => {
			const el = document.querySelector("[title='点击全屏预览']");
			expect(el).not.toBeNull();
			return el;
		})) as HTMLElement;
		const dialogImg = zoomButton.querySelector("img") as HTMLImageElement;
		expect(dialogImg).not.toBeNull();
		Object.defineProperty(dialogImg, "naturalWidth", { value: 400 });
		Object.defineProperty(dialogImg, "naturalHeight", { value: 300 });

		const fullscreenRoot = await openFullscreen();

		// 素材缩略图(300px 静态文件)只提供比例,若飞入盒按视口 contain
		// 出盒(921.6x691.2),原图加载后再缩到 400x300——用户看到先大后小。
		// 契约:飞入盒直接按原图 natural 尺寸。
		const box = await waitFor(() => {
			const el = fullscreenRoot.querySelector<HTMLElement>("[style*='width']");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		expect(Number.parseFloat(box.style.width)).toBeCloseTo(400, 1);
		expect(Number.parseFloat(box.style.height)).toBeCloseTo(300, 1);
	});

	it("点击全屏遮罩关闭预览后,查看 Dialog 不应被连带关闭", async () => {
		const { onOpenChange } = renderLightbox();
		const fullscreenRoot = await openFullscreen();

		// 模拟真实点击序列:pointerdown(DismissableLayer 记录外部按下)+ click(触发 onClose)
		fireEvent.pointerDown(fullscreenRoot);
		fireEvent.click(fullscreenRoot);

		await waitFullscreenGone();
		expect(document.querySelector("[role=dialog]")).not.toBeNull();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	it("ESC 关闭全屏预览后,查看 Dialog 不应被连带关闭", async () => {
		const { onOpenChange } = renderLightbox();
		await openFullscreen();

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFullscreenGone();
		expect(document.querySelector("[role=dialog]")).not.toBeNull();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});
});
