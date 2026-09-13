import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpriteSheet } from "./SpriteSheet";

function mockMatchMedia(matches: boolean) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockReturnValue({
			matches,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}),
	);
}

function spriteElement(container: HTMLElement) {
	const el = container.querySelector<HTMLSpanElement>("span[aria-hidden='true']");
	expect(el).not.toBeNull();
	return el as HTMLSpanElement;
}

/** 与组件一致的网格坐标公式（CSS background-position 百分比语义）。 */
function gridPosition(cols: number, rows: number, frame: number) {
	const col = frame % cols;
	const row = Math.floor(frame / cols);
	const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
	const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
	return `${x}% ${y}%`;
}

describe("SpriteSheet", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockMatchMedia(false);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("按左到右、上到下顺序遍历多行多列网格并循环", () => {
		const { container } = render(<SpriteSheet src="/sprite.webp" cols={5} rows={3} fps={5} />);
		const el = spriteElement(container);

		expect(el.style.backgroundSize).toBe("500% 300%");

		// 依次断言：首帧、行内推进、两处换行边界、末帧、循环回起点
		const checkpoints = [0, 1, 4, 5, 7, 10, 11, 14, 15];
		let advanced = 0;
		for (const frame of checkpoints) {
			act(() => vi.advanceTimersByTime((frame - advanced) * 200));
			advanced = frame;
			// 第 15 拍已循环回第 0 帧
			const effective = frame % 15;
			expect(el.style.backgroundPosition).toBe(gridPosition(5, 3, effective));
		}
	});

	it("frames 覆盖末行不满的网格：跳过空格直接循环", () => {
		const { container } = render(
			<SpriteSheet src="/sprite.webp" cols={4} rows={3} frames={10} fps={5} />,
		);
		const el = spriteElement(container);

		// 第 10 帧（索引 9）位于第 3 行第 2 列
		act(() => vi.advanceTimersByTime(9 * 200));
		expect(el.style.backgroundPosition).toBe(gridPosition(4, 3, 9));

		// 下一拍直接回到第 1 帧，绝不进入末行空格
		act(() => vi.advanceTimersByTime(200));
		expect(el.style.backgroundPosition).toBe(gridPosition(4, 3, 0));
	});

	it("paused 时停在最后一帧且不推进", () => {
		const { container } = render(
			<SpriteSheet src="/sprite.webp" cols={15} paused className="w-12" />,
		);
		const el = spriteElement(container);

		expect(el.style.backgroundPosition).toBe(gridPosition(15, 1, 14));

		act(() => vi.advanceTimersByTime(1000));
		expect(el.style.backgroundPosition).toBe(gridPosition(15, 1, 14));
	});

	it("减弱动态偏好下停帧不播放", () => {
		mockMatchMedia(true);
		const { container } = render(<SpriteSheet src="/sprite.webp" cols={5} rows={3} />);

		const el = spriteElement(container);
		expect(el.style.backgroundPosition).toBe(gridPosition(5, 3, 14));

		act(() => vi.advanceTimersByTime(2000));
		expect(el.style.backgroundPosition).toBe(gridPosition(5, 3, 14));
	});

	it("单行雪碧图纵向坐标恒为 0%", () => {
		const { container } = render(<SpriteSheet src="/sprite.webp" cols={15} fps={15} />);
		const el = spriteElement(container);

		expect(el.style.backgroundSize).toBe("1500% 100%");

		act(() => vi.advanceTimersByTime(7 * (1000 / 15)));
		expect(el.style.backgroundPosition).toBe(gridPosition(15, 1, 7));
	});
});
