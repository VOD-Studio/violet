import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionCharter } from "../MotionCharter";
import { FadeIn, NumberFlow, TextReveal } from "../motion-effects";

describe("动效效果库画廊", () => {
	it("总纲与三律法齐备", () => {
		render(<MotionCharter />);
		expect(screen.getByText("合成层律")).toBeTruthy();
		expect(screen.getByText("场景律")).toBeTruthy();
		expect(screen.getByText("快进快出律")).toBeTruthy();
	});

	it("十个效果全部陈列且可重播", () => {
		render(<MotionCharter />);
		for (const name of [
			"FadeIn · 淡入",
			"SlideIn · 滑入",
			"BlurIn · 模糊聚焦",
			"ScaleIn · 缩放入座",
			"TextReveal · 逐词揭示",
			"Stagger · 级联编排",
			"NumberFlow · 数字滚动",
			"Shine · 扫光",
			"BorderBeam · 流光边框",
			"Magnetic · 磁吸",
		]) {
			expect(screen.getByText(name)).toBeTruthy();
		}
		// 每卡都有重播按钮
		const replays = screen.getAllByRole("button", { name: "重播" });
		expect(replays.length).toBe(10);
		for (const btn of replays) {
			fireEvent.click(btn);
		}
	});

	it("TextReveal 逐词拆分渲染", () => {
		render(<TextReveal text="一花一叶 皆成文章" />);
		expect(screen.getByText(/一花一叶/)).toBeTruthy();
	});

	it("NumberFlow 渲染等宽数字容器", () => {
		render(<NumberFlow value={12846} />);
		expect(document.querySelector(".tabular-nums")).toBeTruthy();
	});

	it("FadeIn 包裹内容可见", () => {
		render(
			<FadeIn>
				<p>包裹内容</p>
			</FadeIn>,
		);
		expect(screen.getByText("包裹内容")).toBeTruthy();
	});
});
