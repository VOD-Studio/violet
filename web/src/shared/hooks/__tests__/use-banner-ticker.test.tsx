import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBannerTicker } from "../use-banner-ticker";

let frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let clock = 0;

function Ticker() {
	const { index, progress, paused, setPaused, hoverHandlers, wheelRef } = useBannerTicker(
		2,
		1000,
	);
	return (
		<>
			<div role="group" aria-label="轮播" ref={wheelRef} {...hoverHandlers}>
				<a href="#details">详情</a>
				<button type="button">关闭</button>
				<output aria-label="当前条目">{index}</output>
				<output aria-label="驻留进度">{progress}</output>
				<output aria-label="暂停">{String(paused)}</output>
			</div>
			<button type="button" onClick={() => setPaused(true)}>
				显式暂停
			</button>
			<button type="button" onClick={() => setPaused(false)}>
				显式恢复
			</button>
		</>
	);
}

function frame(ms: number) {
	act(() => {
		clock += ms;
		const callbacks = [...frames.values()];
		frames.clear();
		for (const callback of callbacks) callback(clock);
	});
}

beforeEach(() => {
	clock = 0;
	frames = new Map();
	nextFrameId = 1;
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
	vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("useBannerTicker 暂停原因", () => {
	it("鼠标离开不解除键盘暂停，内部焦点交接不中断暂停，离开后续走累计时间", () => {
		render(<Ticker />);
		const layer = screen.getByLabelText("轮播");
		const link = screen.getByRole("link");
		const close = screen.getByRole("button", { name: "关闭" });
		frame(400);
		fireEvent.mouseOver(layer);
		fireEvent.focus(link);
		fireEvent.mouseOut(layer);
		frame(2000);
		expect(screen.getByLabelText("驻留进度").textContent).toBe("0.4");
		expect(screen.getByLabelText("当前条目").textContent).toBe("0");
		fireEvent.blur(link, { relatedTarget: close });
		frame(2000);
		expect(screen.getByLabelText("暂停").textContent).toBe("true");
		expect(screen.getByLabelText("当前条目").textContent).toBe("0");
		fireEvent.focus(close, { relatedTarget: link });
		fireEvent.blur(close, { relatedTarget: null });
		frame(599);
		expect(screen.getByLabelText("当前条目").textContent).toBe("0");
		frame(1);
		expect(screen.getByLabelText("当前条目").textContent).toBe("1");
	});

	it("焦点离开不解除悬停暂停，鼠标离开后才恢复", () => {
		render(<Ticker />);
		const layer = screen.getByLabelText("轮播");
		const close = screen.getByRole("button", { name: "关闭" });
		fireEvent.mouseOver(layer);
		fireEvent.focus(close);
		fireEvent.blur(close, { relatedTarget: null });
		frame(2000);
		expect(screen.getByLabelText("当前条目").textContent).toBe("0");
		fireEvent.mouseOut(layer);
		frame(1000);
		expect(screen.getByLabelText("当前条目").textContent).toBe("1");
	});

	it("显式暂停不会被交互解除，显式恢复也不覆盖仍在的悬停或焦点", () => {
		render(<Ticker />);
		const layer = screen.getByLabelText("轮播");
		const close = screen.getByRole("button", { name: "关闭" });
		fireEvent.click(screen.getByRole("button", { name: "显式暂停" }));
		fireEvent.mouseOver(layer);
		fireEvent.focus(close);
		fireEvent.mouseOut(layer);
		fireEvent.blur(close, { relatedTarget: null });
		frame(2000);
		expect(screen.getByLabelText("暂停").textContent).toBe("true");
		fireEvent.mouseOver(layer);
		fireEvent.focus(close);
		fireEvent.click(screen.getByRole("button", { name: "显式恢复" }));
		frame(2000);
		expect(screen.getByLabelText("当前条目").textContent).toBe("0");
		fireEvent.mouseOut(layer);
		frame(2000);
		expect(screen.getByLabelText("暂停").textContent).toBe("true");
		fireEvent.blur(close, { relatedTarget: null });
		frame(1000);
		expect(screen.getByLabelText("当前条目").textContent).toBe("1");
	});
});
