import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileCard } from "../ProfileCard";

describe("ProfileCard React Bits 组件", () => {
	afterEach(cleanup);

	it("正常渲染子内容并附加 3D 视角与环境光晕", () => {
		const { container } = render(
			<ProfileCard behindGlowClass="bg-neon-cyan/20">
				<div data-testid="child-content">测试卡片内容</div>
			</ProfileCard>,
		);

		expect(screen.getByTestId("child-content")).toBeTruthy();
		const root = container.firstElementChild as HTMLElement;
		expect(root.classList.contains("group/profile-card")).toBe(true);

		// 验证背后发光层
		const behindGlow = root.querySelector<HTMLElement>(".bg-neon-cyan\\/20");
		expect(behindGlow).toBeTruthy();
	});

	it("鼠标移动时计算坐标并响应", () => {
		const { container } = render(
			<ProfileCard>
				<div>卡片</div>
			</ProfileCard>,
		);

		const cardElement = container.querySelector(".overflow-hidden") as HTMLElement;
		expect(cardElement).toBeTruthy();

		// 触发鼠标移动与移出
		fireEvent.mouseMove(cardElement, { clientX: 100, clientY: 150 });
		fireEvent.mouseLeave(cardElement);
	});
});
