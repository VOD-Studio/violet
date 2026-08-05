/**
 * ImagePreview 缩略图→原图交叉淡入透出回归测试。
 *
 * 回归背景:点击预览后,缩略图+模糊层在原图 onLoad 时开始淡出,但此刻
 * 原图自身可能还不可见——
 * 1) 原图 motion.img 挂载时带 opacity 0→1 淡入,缓存命中时 onLoad 同步触发,
 *    缩略图层淡出与原图淡入重叠,两层叠加透明度 <1;
 * 2) onLoad 只代表下载完成,大图可能尚未解码上屏,淡出期间原图区域透明。
 * 两者都导致 bg-black/70 遮罩下的页面排版从图片盒里透出来("闪一下排版")。
 * 修复:有缩略图占位覆盖时原图直接不透明挂载(不淡入);onLoad 上报前等
 * img.decode() 确保像素已就绪。
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImagePreviewImage } from "../components/ImagePreviewImage";

// 捕获传给 motion.img 的 props,用于断言初始透明度;motion 专有 props 不下发 DOM
const captured = vi.hoisted(() => ({ imgProps: null as Record<string, unknown> | null }));

function MotionDiv({ children, ...rest }: { children?: ReactNode; [key: string]: unknown }) {
	const safeProps: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(rest)) {
		if (key.startsWith("on") || ["className", "style", "role", "aria-hidden"].includes(key)) {
			safeProps[key] = value;
		}
	}
	return <div {...safeProps}>{children}</div>;
}

function MotionImg(props: Record<string, unknown>) {
	captured.imgProps = props;
	const { initial, animate, exit, transition, whileDrag, ...domProps } = props;
	return <img alt="" {...domProps} />;
}

function AnimatePresenceWrapper({ children }: { children?: ReactNode }) {
	return <>{children}</>;
}

vi.mock("motion/react", () => ({
	motion: { div: MotionDiv, img: MotionImg },
	AnimatePresence: AnimatePresenceWrapper,
}));

function renderImage(overrides: Partial<Parameters<typeof ImagePreviewImage>[0]> = {}) {
	const onLoad = vi.fn();
	render(
		<ImagePreviewImage
			src="/uploads/a.jpg"
			alt=""
			scale={1}
			shouldLoad
			onLoad={onLoad}
			{...overrides}
		/>,
	);
	const img = document.querySelector("img.object-contain") as HTMLImageElement;
	expect(img).not.toBeNull();
	return { img, onLoad };
}

describe("ImagePreview 交叉淡入透出", () => {
	afterEach(() => {
		cleanup(); // 无全局自动 cleanup,querySelector 会命中上个用例的残留 img
		captured.imgProps = null;
	});

	it("原图 load 后须等 decode 完成才上报 onLoad,否则占位层淡出时像素未上屏", async () => {
		let resolveDecode: () => void = () => {};
		const { img, onLoad } = renderImage({ showSpinner: false });
		// jsdom 的 img 无 decode/naturalWidth,按真实浏览器补齐
		Object.defineProperty(img, "naturalWidth", { value: 400 });
		Object.defineProperty(img, "naturalHeight", { value: 300 });
		Object.defineProperty(img, "decode", {
			value: () =>
				new Promise<void>((resolve) => {
					resolveDecode = resolve;
				}),
		});

		fireEvent.load(img);
		// 解码未完成:不得上报(此刻外层若淡出缩略图占位,透出遮罩与页面排版)
		expect(onLoad).not.toHaveBeenCalled();

		await act(async () => resolveDecode());
		expect(onLoad).toHaveBeenCalledTimes(1);
	});

	it("decode 不可用(老浏览器/jsdom)时仍按原路径上报 onLoad", () => {
		const { img, onLoad } = renderImage();
		fireEvent.load(img);
		expect(onLoad).toHaveBeenCalledTimes(1);
	});

	it("decode 失败时仍上报 onLoad,避免永久卡在占位层", async () => {
		const { img, onLoad } = renderImage();
		Object.defineProperty(img, "decode", {
			value: () => Promise.reject(new Error("decode failed")),
		});
		fireEvent.load(img);
		await act(async () => {});
		expect(onLoad).toHaveBeenCalledTimes(1);
	});

	it("有缩略图占位覆盖时(showSpinner=false),原图不得以透明态淡入挂载", () => {
		renderImage({ showSpinner: false });
		// 缩略图层在原图加载完成前一直覆盖原图,原图淡入没有意义;
		// 一旦缓存命中 onLoad 同步触发,缩略图层淡出会与原图淡入重叠透出背景
		expect(captured.imgProps?.initial).toEqual({ opacity: 1 });
	});

	it("无缩略图占位时(showSpinner=true),保留原图淡入", () => {
		renderImage({ showSpinner: true });
		expect(captured.imgProps?.initial).toEqual({ opacity: 0 });
	});
});
