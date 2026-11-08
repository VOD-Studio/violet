import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../date-range-picker";
import type { DateRange } from "../types";

const start = () => screen.getByRole<HTMLInputElement>("textbox", { name: "区间" });
const end = () => screen.getByRole<HTMLInputElement>("textbox", { name: "区间：结束日期" });
const novemberDay = (name: string) =>
	within(screen.getByRole("grid", { name: "2026 年 11 月" })).getByRole("button", { name });

describe("DateRangePicker 端点与预览", () => {
	it("先选起点，指针与键盘预览不提交，较早终点自动对调并关闭", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				defaultValue={{ start: "2026-11-03", end: "2026-11-07" }}
				onChange={change}
			/>,
		);
		fireEvent.focus(start());
		expect(screen.getAllByRole("grid")).toHaveLength(2);
		fireEvent.click(novemberDay("2026 年 11 月 10 日 星期二"));
		expect(screen.getByRole("status").textContent).toBe("已选起点 11 月 10 日，请选终点");
		fireEvent.pointerEnter(novemberDay("2026 年 11 月 5 日 星期四"));
		expect(novemberDay("2026 年 11 月 5 日 星期四").getAttribute("aria-pressed")).toBe("false");
		expect(change).not.toHaveBeenCalled();
		fireEvent.keyDown(start(), { key: "ArrowUp" });
		expect(
			document
				.getElementById(start().getAttribute("aria-activedescendant") ?? "")
				?.getAttribute("aria-label"),
		).toBe("2026 年 11 月 3 日 星期二");
		fireEvent.keyDown(start(), { key: "Enter" });
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-10" });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("直接打开结束输入只改结束端点，并保留原起点", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				defaultValue={{ start: "2026-11-03", end: "2026-11-07" }}
				onChange={change}
			/>,
		);
		fireEvent.focus(end());
		fireEvent.click(novemberDay("2026 年 11 月 12 日 星期四"));
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-03", end: "2026-11-12" });
		expect(start().value).toBe("2026-11-03");
		expect(end().value).toBe("2026-11-12");
	});

	it("键入一个端点规范化并对调；非法输入恢复端点", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				defaultValue={{ start: "2026-11-03", end: "2026-11-07" }}
				onChange={change}
			/>,
		);
		fireEvent.change(end(), { target: { value: "2026/11/1" } });
		fireEvent.keyDown(end(), { key: "Enter" });
		expect(change).toHaveBeenCalledExactlyOnceWith({ start: "2026-11-01", end: "2026-11-03" });
		fireEvent.change(start(), { target: { value: "2026-02-30" } });
		fireEvent.blur(start());
		expect(start().value).toBe("2026-11-01");
		expect(start().getAttribute("aria-invalid")).toBe("true");
		expect(change).toHaveBeenCalledTimes(1);
	});

	it("开放区间可用预设、键入、清除，清除不受 clearable=false 限制", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				clearable={false}
				presets={[
					{ label: "从某日起", value: { start: "2026/11/3" } },
					{ label: "不限", value: {} },
				]}
				onChange={change}
			/>,
		);
		fireEvent.focus(start());
		fireEvent.click(screen.getByRole("button", { name: "从某日起" }));
		expect(change).toHaveBeenLastCalledWith({ start: "2026-11-03", end: undefined });
		fireEvent.focus(start());
		fireEvent.click(screen.getByRole("button", { name: "不限" }));
		expect(start().value).toBe("");
		expect(end().value).toBe("");
		fireEvent.change(end(), { target: { value: "2026.11.7" } });
		fireEvent.blur(end());
		expect(change).toHaveBeenLastCalledWith({ start: undefined, end: "2026-11-07" });
	});

	it("不允许开放区间时拒绝单端点预设，optional 仍允许整个清空", () => {
		render(
			<DateRangePicker
				aria-label="区间"
				allowOpenEnded={false}
				defaultValue={{ start: "2026-11-03", end: "2026-11-07" }}
				presets={[
					{ label: "单端点", value: { start: "2026-11-03" } },
					{ label: "不限", value: {} },
				]}
			/>,
		);
		fireEvent.focus(start());
		expect(screen.getByRole("button", { name: "单端点" }).hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "不限" }));
		expect(start().value).toBe("");
		expect(end().value).toBe("");
	});

	it("受控更新后端点与表单保持一致，取消临时选择不提交", () => {
		function ControlledRange() {
			const [value, setValue] = useState<DateRange>({
				start: "2026-11-03",
				end: "2026-11-07",
			});
			return <DateRangePicker aria-label="区间" value={value} onChange={setValue} />;
		}
		render(<ControlledRange />);
		fireEvent.focus(start());
		fireEvent.click(novemberDay("2026 年 11 月 10 日 星期二"));
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(start().value).toBe("2026-11-03");
		expect(end().value).toBe("2026-11-07");
		fireEvent.focus(end());
		fireEvent.click(novemberDay("2026 年 11 月 12 日 星期四"));
		expect(end().value).toBe("2026-11-12");
	});
});

describe("DateRangePicker 时间与原生表单", () => {
	it("日期时间范围的时分只在确定后提交，交换时包含时间", () => {
		const change = vi.fn();
		render(
			<DateRangePicker
				aria-label="区间"
				mode="datetime"
				defaultValue={{ start: "2026-11-03T09:30", end: "2026-11-07T18:00" }}
				onChange={change}
			/>,
		);
		fireEvent.focus(start());
		fireEvent.click(screen.getByRole("button", { name: "开始时间：时 12" }));
		fireEvent.click(screen.getByRole("button", { name: "结束时间：分 45" }));
		expect(change).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "确定" }));
		expect(change).toHaveBeenCalledExactlyOnceWith({
			start: "2026-11-03T12:30",
			end: "2026-11-07T18:45",
		});
	});

	it("ref、端点名字与外部 form 原生提交，reset 恢复两个默认端点", async () => {
		const ref = createRef<HTMLInputElement>();
		const endRef = createRef<HTMLInputElement>();
		render(
			<>
				<form id="report" aria-label="报表" />
				<DateRangePicker
					ref={ref}
					id="period"
					name="period"
					form="report"
					aria-label="区间"
					defaultValue={{ start: "2026-11-03" }}
					endInputProps={{ ref: endRef, id: "period-end" }}
				/>
			</>,
		);
		expect(ref.current).toBe(start());
		expect(endRef.current).toBe(end());
		expect(document.getElementById("period-end")).toBe(end());
		fireEvent.change(end(), { target: { value: "2026/11/7" } });
		fireEvent.blur(end());
		const form = screen.getByRole<HTMLFormElement>("form", { name: "报表" });
		expect([...new FormData(form)]).toEqual([
			["period.start", "2026-11-03"],
			["period.end", "2026-11-07"],
		]);
		await act(async () => {
			form.reset();
		});
		expect(start().value).toBe("2026-11-03");
		expect(end().value).toBe("");
	});

	it("required 两端参与原生必填校验，非法开放初值参与 validity", () => {
		const { rerender } = render(<DateRangePicker aria-label="区间" required />);
		expect(start().validity.valueMissing).toBe(true);
		expect(end().validity.valueMissing).toBe(true);
		rerender(
			<DateRangePicker
				key="closed"
				aria-label="区间"
				allowOpenEnded={false}
				defaultValue={{ start: "2026-11-03" }}
			/>,
		);
		expect(start().validity.customError).toBe(true);
		expect(end().validity.customError).toBe(true);
		expect(start().validationMessage).toBe("请选择完整的日期范围");
	});

	it("日期时间范围的输入显示空格分隔，原生提交的两端仍是规范 T 格式", () => {
		render(
			<form aria-label="报表">
				<DateRangePicker
					aria-label="区间"
					mode="datetime"
					name="period"
					defaultValue={{ start: "2026-11-03T09:30", end: "2026-11-07T18:00" }}
				/>
			</form>,
		);
		expect(start().value).toBe("2026-11-03 09:30");
		expect(end().value).toBe("2026-11-07 18:00");
		const form = screen.getByRole<HTMLFormElement>("form", { name: "报表" });
		expect([...new FormData(form)]).toEqual([
			["period.start", "2026-11-03T09:30"],
			["period.end", "2026-11-07T18:00"],
		]);
	});

	it("触发器的端点标记随正在编辑的输入切换，样式据此显示开始还是结束", () => {
		render(
			<DateRangePicker
				aria-label="区间"
				defaultValue={{ start: "2026-11-03", end: "2026-11-07" }}
			/>,
		);
		const shell = start().closest(".v-date-picker") as HTMLElement;
		fireEvent.focus(start());
		expect(shell.getAttribute("data-endpoint")).toBe("start");
		fireEvent.focus(end());
		expect(shell.getAttribute("data-endpoint")).toBe("end");
	});
});
