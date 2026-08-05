/**
 * ImagePreview 飞入→原图替换链路集成测试(不 mock motion,真实动画)。
 *
 * 链路:flyInSettled(onAnimationComplete/兜底超时)→ shouldLoad
 * → 原图 <img> 挂载 → onLoad → originalLoaded → 缩略图层淡出。
 * 与 ImagePreview.fallback.test.tsx 互补:那里 mock motion 验证回调不触发时的
 * 兜底;这里用真实 motion 验证正常链路最终主显示为原图、不停留在 ?w= 缩略图。
 */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

// jsdom 中让 probe(new Image())立即成功并带 natural size
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

describe("ImagePreview 原图替换链路(真实 motion)", () => {
	const originalImage = global.Image;

	beforeEach(() => {
		vi.stubGlobal("Image", MockImage as unknown as typeof Image);
	});

	afterEach(() => {
		vi.stubGlobal("Image", originalImage);
	});

	it("打开预览后,缩略图占位应被原图替换,不停留在 ?w= 缩略图", async () => {
		const images = ["/uploads/a.png"];
		const thumbnails = ["/uploads/a.png?w=600&format=webp"];

		render(
			<ImagePreview
				open
				onClose={() => {}}
				images={images}
				thumbnails={thumbnails}
				currentIndex={0}
			/>,
		);

		// 1. flyInSettled 后原图 <img> 必须挂载(shouldLoad 门控,依赖真实 onAnimationComplete)
		const original = await waitFor(
			() => {
				const el = document.querySelector("img.object-contain");
				expect(el).not.toBeNull();
				return el as HTMLImageElement;
			},
			{ timeout: 3000 },
		);
		expect(original.src).toContain("/uploads/a.png");

		// 2. 模拟原图加载完成 → 缩略图层应淡出移除
		fireEvent.load(original);

		await waitFor(
			() => {
				expect(document.querySelector('img[src*="w=600"]')).toBeNull();
			},
			{ timeout: 3000 },
		);
	});
});
