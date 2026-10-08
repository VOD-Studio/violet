import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
});
