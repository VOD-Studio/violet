import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePixelReveal } from "./ImagePixelReveal";

vi.mock("motion/react", () => ({
	useReducedMotion: () => false,
}));

const TEST_RECT = {
	bottom: 120,
	height: 120,
	left: 0,
	right: 120,
	top: 0,
	width: 120,
	x: 0,
	y: 0,
	toJSON: () => ({}),
} as DOMRect;

describe("ImagePixelReveal", () => {
	const animationFrames: FrameRequestCallback[] = [];

	beforeEach(() => {
		vi.useFakeTimers();
		animationFrames.length = 0;
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(TEST_RECT);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("先让原图在完整瓦片层后落位，再移除瓦片层", () => {
		const onRevealed = vi.fn();
		const { container } = render(
			<ImagePixelReveal
				src="/avatar.png"
				alt="头像"
				duration={0.1}
				spreadMs={0}
				onRevealed={onRevealed}
			/>,
		);
		const image = screen.getByRole("img", { name: "头像" });
		Object.defineProperty(image, "naturalWidth", { value: 120 });
		Object.defineProperty(image, "naturalHeight", { value: 120 });
		fireEvent.load(image);

		expect(container.querySelectorAll("span").length).toBeGreaterThan(0);

		act(() => vi.advanceTimersByTime(160));
		expect(container.querySelectorAll("span").length).toBeGreaterThan(0);
		expect(onRevealed).not.toHaveBeenCalled();

		act(() => animationFrames.shift()?.(0));
		expect(container.querySelectorAll("span").length).toBeGreaterThan(0);

		act(() => animationFrames.shift()?.(16));
		expect(container.querySelectorAll("span")).toHaveLength(0);
		expect(onRevealed).toHaveBeenCalledTimes(1);
	});
});
