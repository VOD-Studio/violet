import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Steps } from "../steps";

const ITEMS = [
	{ title: "填写信息", description: "作者与标题" },
	{ title: "验证站点" },
	{ title: "发布" },
];

afterEach(cleanup);

describe("Steps", () => {
	it("按位置给三档状态，当前一步带 aria-current 与读屏状态文本", () => {
		const { container } = render(<Steps steps={ITEMS} current={1} />);
		const items = container.querySelectorAll("li");
		expect(items).toHaveLength(3);
		expect(items[0]?.dataset.status).toBe("done");
		expect(items[1]?.dataset.status).toBe("current");
		expect(items[1]?.getAttribute("aria-current")).toBe("step");
		expect(items[2]?.dataset.status).toBe("upcoming");
		expect(screen.getByText("已完成")).toBeTruthy();
		expect(screen.getByText("进行中")).toBeTruthy();
		expect(screen.getByText("未开始")).toBeTruthy();
	});

	it("已完成步骤可点回去，当前与未到的圆点不是按钮", () => {
		const onStepClick = vi.fn();
		const { container } = render(<Steps steps={ITEMS} current={2} onStepClick={onStepClick} />);
		const buttons = container.querySelectorAll("button");
		expect(buttons).toHaveLength(2);
		expect(buttons[0]?.getAttribute("aria-label")).toBe("第 1 步，填写信息，已完成");
		fireEvent.click(buttons[1] as HTMLElement);
		expect(onStepClick).toHaveBeenCalledWith(1);
		expect(container.querySelectorAll("li")[2]?.querySelector("button")).toBeNull();
	});

	it("没有 onStepClick 时已完成步骤也不可交互", () => {
		const { container } = render(<Steps steps={ITEMS} current={2} />);
		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("出错语气只标记当前一步，仍视为当前步骤", () => {
		const { container } = render(<Steps steps={ITEMS} current={1} tone="error" />);
		const current = container.querySelectorAll("li")[1];
		expect(current?.dataset.status).toBe("error");
		expect(current?.getAttribute("aria-current")).toBe("step");
		expect(current?.querySelector(".v-steps__dot")?.textContent).toBe("!");
		expect(current?.querySelector(".v-steps__status")?.textContent).toBe("出错");
	});

	it("方向与原生属性透传，ref 指向列表", () => {
		const ref = createRef<HTMLOListElement>();
		render(
			<Steps
				ref={ref}
				steps={ITEMS}
				current={0}
				orientation="vertical"
				aria-label="发布流程"
			/>,
		);
		const list = screen.getByRole("list", { name: "发布流程" });
		expect(list.tagName).toBe("OL");
		expect(list.getAttribute("data-orientation")).toBe("vertical");
		expect(ref.current).toBe(list);
	});

	it("步骤为空时不渲染条目也不抛错", () => {
		const { container } = render(<Steps steps={[]} current={0} />);
		expect(container.querySelectorAll("li")).toHaveLength(0);
	});
});
