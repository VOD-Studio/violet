import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImagePixelReveal } from "../image-pixel-reveal";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("ImagePixelReveal", () => {
	it("播放中开启减弱动态会完成揭示，悬停不再重播", () => {
		const query = "(prefers-reduced-motion: reduce)";
		const events = new EventTarget();
		const legacyListeners = new Set<(event: MediaQueryListEvent) => void>();
		let reduced = false;
		vi.stubGlobal("matchMedia", () => ({
			media: query,
			get matches() {
				return reduced;
			},
			addEventListener: events.addEventListener.bind(events),
			removeEventListener: events.removeEventListener.bind(events),
			addListener: (listener: (event: MediaQueryListEvent) => void) => {
				legacyListeners.add(listener);
			},
			removeListener: (listener: (event: MediaQueryListEvent) => void) => {
				legacyListeners.delete(listener);
			},
		}));
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 240, 320),
		);

		function Consumer() {
			const [completed, setCompleted] = useState(0);
			return (
				<>
					<ImagePixelReveal
						src="/portrait.png"
						alt="肖像"
						role="group"
						aria-label="图片揭示"
						replayOnHover
						onRevealed={() => setCompleted((count) => count + 1)}
					/>
					<output aria-label="揭示完成次数">{completed}</output>
				</>
			);
		}

		render(<Consumer />);
		fireEvent.load(screen.getByRole("img", { name: "肖像" }));
		expect(screen.getByLabelText("揭示完成次数").textContent).toBe("0");

		act(() => {
			reduced = true;
			const event = Object.assign(new Event("change"), { media: query, matches: true });
			events.dispatchEvent(event);
			for (const listener of legacyListeners) listener(event);
		});

		expect(screen.getByLabelText("揭示完成次数").textContent).toBe("1");
		const imageGroup = screen.getByRole("group", { name: "图片揭示" });
		expect(imageGroup.getAttribute("data-state")).toBe("revealed");
		fireEvent.mouseEnter(imageGroup);
		expect(imageGroup.getAttribute("data-state")).toBe("revealed");
		expect(screen.getByLabelText("揭示完成次数").textContent).toBe("1");
	});

	it("加载未完成前在占位区渲染桂花，加载完成后占位卸载", () => {
		const { container } = render(<ImagePixelReveal src="/landscape.png" alt="山水" />);
		expect(container.querySelector(".v-flower--osmanthus")).toBeTruthy();
		fireEvent.load(screen.getByRole("img", { name: "山水" }));
		expect(container.querySelector(".v-flower--osmanthus")).toBeNull();
	});

	it("水合前已失败的图片能立即通知调用方显示降级内容", async () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
		function Consumer() {
			const [failed, setFailed] = useState(false);
			return failed ? (
				<span role="img" aria-label="肖像不可用">
					R
				</span>
			) : (
				<ImagePixelReveal src="/portrait.png" alt="肖像" onError={() => setFailed(true)} />
			);
		}
		const container = document.createElement("div");
		container.innerHTML = renderToString(<Consumer />);
		document.body.append(container);
		let hydrated: ReturnType<typeof hydrateRoot> | undefined;
		try {
			await act(async () => {
				hydrated = hydrateRoot(container, <Consumer />);
			});
			expect(screen.getByRole("img", { name: "肖像不可用" }).textContent).toBe("R");
			expect(container.querySelector("img")).toBeNull();
		} finally {
			await act(async () => hydrated?.unmount());
			container.remove();
		}
	});
});
