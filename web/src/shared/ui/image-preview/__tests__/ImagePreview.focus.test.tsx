import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { type ImgHTMLAttributes, type ReactNode, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

interface MotionDivProps {
	children?: ReactNode;
	onAnimationComplete?: () => void;
	ref?: React.Ref<HTMLDivElement>;
	[key: string]: unknown;
}

// 与 ImagePreview.test.tsx 同款 mock，但透传 ref 与对话框语义属性——
// 焦点用例依赖 overlay 真实挂载 ref / role / tabIndex。
function MotionDiv({ children, onAnimationComplete, ref, ...rest }: MotionDivProps) {
	const hasCompleted = useRef(false);
	if (!hasCompleted.current) {
		hasCompleted.current = true;
		onAnimationComplete?.();
	}

	const safeProps: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(rest)) {
		if (
			key.startsWith("on") ||
			[
				"className",
				"style",
				"role",
				"aria-label",
				"aria-modal",
				"aria-hidden",
				"title",
				"id",
				"tabIndex",
			].includes(key)
		) {
			safeProps[key] = value;
		}
	}

	return (
		<div ref={ref} {...safeProps}>
			{children}
		</div>
	);
}

function MotionImg(props: ImgHTMLAttributes<HTMLImageElement>) {
	return <img alt="" {...props} />;
}

function AnimatePresenceWrapper({ children }: { children?: ReactNode }) {
	return <>{children}</>;
}

vi.mock("motion/react", () => ({
	motion: {
		div: MotionDiv,
		img: MotionImg,
	},
	AnimatePresence: AnimatePresenceWrapper,
}));

// jsdom 中需要让 Image 加载立即成功并带上 natural size
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

/** 可开关的预览挂具：触发按钮打开，Escape 关闭。 */
function Harness({ alts }: { alts?: string[] }) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
				触发
			</button>
			<ImagePreview
				open={open}
				onClose={() => setOpen(false)}
				images={["/img1.jpg", "/img2.jpg"]}
				alts={alts}
				currentIndex={0}
				triggerElement={triggerRef.current}
			/>
		</>
	);
}

function activeElement(): HTMLElement | null {
	return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function dialog(): HTMLElement | null {
	return document.querySelector('[role="dialog"]');
}

describe("ImagePreview 焦点管理", () => {
	const originalImage = global.Image;

	beforeEach(() => {
		vi.stubGlobal("Image", MockImage as unknown as typeof Image);
	});

	afterEach(() => {
		cleanup();
		vi.stubGlobal("Image", originalImage);
	});

	it("打开时焦点移入对话框，关闭后归还触发元素", () => {
		render(<Harness />);

		const trigger = document.querySelector("button") as HTMLButtonElement;
		fireEvent.click(trigger);

		expect(dialog()).not.toBeNull();
		expect(activeElement()?.getAttribute("role")).toBe("dialog");

		fireEvent.keyDown(window, { key: "Escape" });

		expect(dialog()).toBeNull();
		expect(activeElement()).toBe(trigger);
	});

	it("Tab 在灯箱内首尾循环，不逃出遮罩层", () => {
		render(<Harness />);

		fireEvent.click(document.querySelector("button") as HTMLButtonElement);
		const overlay = dialog() as HTMLElement;
		const buttons = Array.from(overlay.querySelectorAll("button"));

		// 打开时焦点在容器上：Tab 进入第一个按钮
		fireEvent.keyDown(window, { key: "Tab" });
		expect(activeElement()).toBe(buttons[0]);

		// 首元素 shift+Tab 循环到尾
		fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
		expect(activeElement()).toBe(buttons[buttons.length - 1]);

		// 尾元素 Tab 循环回头
		fireEvent.keyDown(window, { key: "Tab" });
		expect(activeElement()).toBe(buttons[0]);
	});

	it("alts 提供逐图替代文本，缺省回退序号文案", async () => {
		render(<Harness alts={["山巅日出", "海面日落"]} />);

		fireEvent.click(document.querySelector("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(document.querySelector("img.object-contain")?.getAttribute("alt")).toBe(
				"山巅日出",
			);
		});

		fireEvent.keyDown(window, { key: "ArrowRight" });

		await waitFor(() => {
			expect(document.querySelector("img.object-contain")?.getAttribute("alt")).toBe(
				"海面日落",
			);
		});
	});

	it("未传 alts 时回退「预览图片 n」", async () => {
		render(<Harness />);

		fireEvent.click(document.querySelector("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(document.querySelector("img.object-contain")?.getAttribute("alt")).toBe(
				"预览图片 1",
			);
		});
	});
});
