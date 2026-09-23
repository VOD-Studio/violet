import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionCharter } from "../MotionCharter";
import {
	CheckmarkDraw,
	CopyButton,
	CounterBadge,
	FadeIn,
	HoldToConfirm,
	HoverLift,
	Magnetic,
	NumberFlow,
	PillSlider,
	QuoteLine,
	SmoothExpand,
	TextReveal,
	TextUnderline,
	TiltCard,
} from "../motion-effects";

describe("动效章程自研动效库", () => {
	it("总纲与三律法齐备", () => {
		render(<MotionCharter />);
		expect(screen.getByText("合成层律")).toBeTruthy();
		expect(screen.getByText("场景律")).toBeTruthy();
		expect(screen.getByText("快进快出律")).toBeTruthy();
	});

	it("交互类与浮现类全部效果陈列", () => {
		render(<MotionCharter />);
		const interactiveTitles = [
			"TiltCard · 3D 聚光灯卡片",
			"PillSlider · 流体滑动胶囊",
			"Magnetic · 磁吸纽扣",
			"InkRipple · 墨晕水波",
			"CheckmarkDraw · 交互打勾",
			"HoldToConfirm · 蓄力长按",
			"Shake · 物理警示摇晃",
			"SmoothExpand · 平滑折叠展开",
			"CopyButton · 就地复制形变",
			"HoverLift · 纸面微浮",
			"CounterBadge · 计数微弹气泡",
			"TextUnderline · 墨线生长下划线",
		];
		for (const name of interactiveTitles) {
			expect(screen.getByText(name)).toBeTruthy();
		}

		const replayTitles = [
			"FadeIn · 淡入",
			"SlideIn · 滑入",
			"QuoteLine · 引用墨脊注入",
			"ScaleIn · 缩放入座",
			"TextReveal · 逐词揭示",
			"Stagger · 级联编排",
			"NumberFlow · 数字滚动",
			"BorderBeam · 流光边框",
			"Shine · 微光扫影",
		];
		for (const name of replayTitles) {
			expect(screen.getByText(name)).toBeTruthy();
		}

		const replays = screen.getAllByRole("button", { name: "重播" });
		expect(replays.length).toBe(replayTitles.length);
		for (const btn of replays) {
			fireEvent.click(btn);
		}
	});

	it("PillSlider 点击切换选中项", () => {
		let selected = "week";
		const items = [
			{ id: "day", label: "日刻" },
			{ id: "week", label: "周序" },
		];
		const { rerender } = render(
			<PillSlider items={items} activeId={selected} onChange={(id) => (selected = id)} />,
		);

		const dayTab = screen.getByRole("tab", { name: "日刻" });
		const weekTab = screen.getByRole("tab", { name: "周序" });
		expect(weekTab.getAttribute("aria-selected")).toBe("true");
		expect(dayTab.getAttribute("aria-selected")).toBe("false");

		fireEvent.click(dayTab);
		expect(selected).toBe("day");

		rerender(
			<PillSlider items={items} activeId={selected} onChange={(id) => (selected = id)} />,
		);
		expect(dayTab.getAttribute("aria-selected")).toBe("true");
	});

	it("CheckmarkDraw 渲染对勾与圆环", () => {
		const { rerender, container } = render(<CheckmarkDraw checked={false} />);
		expect(container.querySelector("circle")).toBeTruthy();
		expect(container.querySelector("path")).toBeTruthy();

		rerender(<CheckmarkDraw checked={true} />);
		const circle = container.querySelector("circle");
		expect(circle?.getAttribute("stroke-dashoffset")).toBe("0");
	});

	it("Magnetic 正常包裹并响应光标", () => {
		const { container } = render(
			<Magnetic>
				<button type="button">测试按钮</button>
			</Magnetic>,
		);
		const wrapper = container.firstChild as HTMLElement;
		fireEvent.mouseEnter(wrapper);
		fireEvent.mouseMove(wrapper, { clientX: 20, clientY: 20 });
		fireEvent.mouseLeave(wrapper);
		expect(screen.getByText("测试按钮")).toBeTruthy();
	});

	it("TiltCard 正常包裹并响应倾斜", () => {
		const { container } = render(
			<TiltCard>
				<p>卡片内容</p>
			</TiltCard>,
		);
		const card = container.firstChild as HTMLElement;
		fireEvent.mouseMove(card, { clientX: 10, clientY: 10 });
		fireEvent.mouseLeave(card);
		expect(screen.getByText("卡片内容")).toBeTruthy();
	});

	it("SmoothExpand 展开收起切换高度过渡属性", () => {
		const { container, rerender } = render(
			<SmoothExpand open={false}>
				<p>折叠内容</p>
			</SmoothExpand>,
		);
		const el = container.firstChild as HTMLElement;
		expect(el.style.gridTemplateRows).toBe("0fr");

		rerender(
			<SmoothExpand open={true}>
				<p>折叠内容</p>
			</SmoothExpand>,
		);
		expect(el.style.gridTemplateRows).toBe("1fr");
	});

	it("HoldToConfirm 长按与松手清零", () => {
		let confirmed = false;
		render(
			<HoldToConfirm
				duration={0.1}
				onConfirm={() => {
					confirmed = true;
				}}
			/>,
		);
		const btn = screen.getByRole("button");
		fireEvent.mouseDown(btn);
		fireEvent.mouseUp(btn);
		expect(confirmed).toBe(false);
	});

	it("TextReveal 逐词拆分渲染", () => {
		render(<TextReveal text="一花一叶 皆成文章" />);
		expect(screen.getByText("一花一叶")).toBeTruthy();
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

	it("CopyButton 点击触发复制与文案切换", async () => {
		render(<CopyButton text="测试文本" />);
		const btn = screen.getByRole("button", { name: "复制" });
		expect(btn).toBeTruthy();
		fireEvent.click(btn);
		expect(await screen.findByText("已复制")).toBeTruthy();
	});

	it("HoverLift 包裹内容正常渲染", () => {
		render(
			<HoverLift>
				<p>纸面微浮</p>
			</HoverLift>,
		);
		expect(screen.getByText("纸面微浮")).toBeTruthy();
	});

	it("CounterBadge 渲染数字", () => {
		render(<CounterBadge count={99} />);
		expect(screen.getByText("99")).toBeTruthy();
	});

	it("TextUnderline 悬停与渲染下划线", () => {
		const { container } = render(<TextUnderline>文字下划线</TextUnderline>);
		const wrapper = container.firstChild as HTMLElement;
		expect(screen.getByText("文字下划线")).toBeTruthy();
		fireEvent.mouseEnter(wrapper);
		fireEvent.mouseLeave(wrapper);
	});

	it("QuoteLine 渲染引文与出处", () => {
		render(<QuoteLine citation="营造法式">引文段落</QuoteLine>);
		expect(screen.getByText("引文段落")).toBeTruthy();
		expect(screen.getByText(/营造法式/)).toBeTruthy();
	});
});
