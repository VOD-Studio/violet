/**
 * ImageCropper 初始选区测试：锁定比例时图片一加载就给出居中的最大选区，
 * 不依赖用户先拖一次；自由比例不预设选区。
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageCropper } from "../ImageCropper";

/** 在 jsdom 里给 img 注入原图与显示尺寸，再触发 load。 */
function loadImage(img: HTMLImageElement, natural: [number, number], shown: [number, number]) {
	Object.defineProperty(img, "naturalWidth", { value: natural[0], configurable: true });
	Object.defineProperty(img, "naturalHeight", { value: natural[1], configurable: true });
	Object.defineProperty(img, "width", { value: shown[0], configurable: true });
	Object.defineProperty(img, "height", { value: shown[1], configurable: true });
	fireEvent.load(img);
}

describe("ImageCropper 初始选区", () => {
	afterEach(cleanup);

	it("宽图：4:1 选区占满宽度并垂直居中", () => {
		const onChange = vi.fn();
		const onImageSize = vi.fn();
		const { container } = render(
			<ImageCropper src="a.png" aspect={4} onChange={onChange} onImageSize={onImageSize} />,
		);
		loadImage(container.querySelector("img") as HTMLImageElement, [2000, 1000], [800, 400]);

		expect(onImageSize).toHaveBeenCalledWith({ w: 2000, h: 1000 });
		const rect = onChange.mock.calls.at(-1)?.[0];
		expect(rect.x).toBeCloseTo(0);
		expect(rect.w).toBeCloseTo(1);
		expect(rect.h).toBeCloseTo(0.5);
		expect(rect.y).toBeCloseTo(0.25);
	});

	it("高图：选区仍是 4:1，宽度占满、高度很窄并垂直居中", () => {
		const onChange = vi.fn();
		const { container } = render(<ImageCropper src="a.png" aspect={4} onChange={onChange} />);
		loadImage(container.querySelector("img") as HTMLImageElement, [1000, 2000], [300, 600]);

		const rect = onChange.mock.calls.at(-1)?.[0];
		// 300×75 显示像素：宽 100%，高 12.5%
		expect(rect.w).toBeCloseTo(1);
		expect(rect.h).toBeCloseTo(0.125);
		expect(rect.y).toBeCloseTo(0.4375);
	});

	it("自由比例：不预设选区", () => {
		const onChange = vi.fn();
		const { container } = render(<ImageCropper src="a.png" onChange={onChange} />);
		loadImage(container.querySelector("img") as HTMLImageElement, [2000, 1000], [800, 400]);
		expect(onChange).not.toHaveBeenCalled();
	});
});
