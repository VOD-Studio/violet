import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

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

	it("打开时焦点移入对话框，关闭后归还触发元素", async () => {
		render(<Harness />);

		const trigger = document.querySelector("button") as HTMLButtonElement;
		fireEvent.click(trigger);

		expect(dialog()).not.toBeNull();
		expect(activeElement()?.getAttribute("role")).toBe("dialog");

		fireEvent.keyDown(window, { key: "Escape" });

		await waitFor(() => expect(dialog()).toBeNull());
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

	it("切图后提供对应图片的替代文本", async () => {
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
});
