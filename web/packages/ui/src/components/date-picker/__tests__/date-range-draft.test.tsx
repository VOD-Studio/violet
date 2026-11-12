import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../date-range-picker";

const start = () => screen.getByRole<HTMLInputElement>("textbox", { name: "区间" });
const end = () => screen.getByRole<HTMLInputElement>("textbox", { name: "区间：结束日期" });
const day = (name: string) =>
	within(screen.getByRole("grid", { name: "2026 年 11 月" })).getByRole("button", { name });
const limits = { min: "2026-11-01", max: "2026-11-30" };

describe("DateRangePicker 完整范围草稿", () => {
	it("必填范围先键入起点，Tab 到终点后才提交完整范围", () => {
		const change = vi.fn();
		render(<DateRangePicker aria-label="区间" required onChange={change} {...limits} />);
		fireEvent.focus(start());
		fireEvent.change(start(), { target: { value: "2026/11/3" } });
		fireEvent.blur(start(), { relatedTarget: end() });
		fireEvent.focus(end());
		expect(start().value).toBe("2026-11-03");
		expect(change).not.toHaveBeenCalled();
		fireEvent.change(end(), { target: { value: "2026/11/7" } });
		fireEvent.keyDown(end(), { key: "Enter" });
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-07" });
		expect(start().checkValidity()).toBe(true);
		expect(end().checkValidity()).toBe(true);
	});

	it("非必填闭区间可先键入终点，半段参与原生校验而不是被清掉", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				allowOpenEnded={false}
				onChange={change}
				{...limits}
			/>,
		);
		fireEvent.focus(end());
		fireEvent.change(end(), { target: { value: "2026-11-07" } });
		fireEvent.blur(end(), { relatedTarget: start() });
		fireEvent.focus(start());
		expect(end().value).toBe("2026-11-07");
		expect(start().validity.customError).toBe(true);
		expect(change).not.toHaveBeenCalled();
		fireEvent.change(start(), { target: { value: "2026-11-03" } });
		fireEvent.keyDown(start(), { key: "Enter" });
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-07" });
		expect(end().validity.customError).toBe(false);
	});

	it("日历选择的暂存起点不会被随后键入的终点覆盖", () => {
		const change = vi.fn();
		render(<DateRangePicker aria-label="区间" onChange={change} {...limits} />);
		fireEvent.focus(start());
		fireEvent.click(day("2026 年 11 月 3 日 星期二"));
		fireEvent.focus(end());
		fireEvent.change(end(), { target: { value: "2026-11-07" } });
		fireEvent.keyDown(end(), { key: "Enter" });
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-07" });
	});

	it("编辑只有终点的开放区间仍提交终点，而不改变区间方向", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				defaultValue={{ end: "2026-11-07" }}
				onChange={change}
				{...limits}
			/>,
		);
		fireEvent.focus(end());
		fireEvent.click(day("2026 年 11 月 12 日 星期四"));
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: undefined, end: "2026-11-12" });
		expect(start().value).toBe("");
		expect(end().value).toBe("2026-11-12");
	});

	it("必填范围从日历终点开始时保留该端，随后选择起点完成范围", () => {
		const change = vi.fn();
		render(<DateRangePicker aria-label="区间" required onChange={change} {...limits} />);
		fireEvent.focus(end());
		fireEvent.click(day("2026 年 11 月 7 日 星期六"));
		expect(start().value).toBe("");
		expect(end().value).toBe("2026-11-07");
		expect(change).not.toHaveBeenCalled();
		fireEvent.focus(start());
		fireEvent.click(day("2026 年 11 月 3 日 星期二"));
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-07" });
	});
});
