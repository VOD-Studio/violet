import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "../date-picker";

const field = () => screen.getByRole<HTMLInputElement>("textbox", { name: "日期" });
const open = () => fireEvent.focus(field());
const day = (name: string) => screen.getByRole("button", { name });

afterEach(() => {
	vi.useRealTimers();
});

describe("DatePicker 键入与原生表单", () => {
	it.each(["2024-2-29", "2024/2/29", "2024.2.29"])("接受 %s 并提交规范日期", (text) => {
		const change = vi.fn();
		render(<DatePicker aria-label="日期" onChange={change} />);
		fireEvent.change(field(), { target: { value: text } });
		expect(change).not.toHaveBeenCalled();
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(field().value).toBe("2024-02-29");
		expect(change).toHaveBeenCalledExactlyOnceWith("2024-02-29");
	});

	it.each([
		"2023-02-29",
		"2026-02-30",
		"2026/11.7",
		"0000-01-01",
		"2026-13-01",
		"2026-11-07 09:30",
		"2026-11-31",
	])("拒绝 %s，失焦恢复已提交值", (text) => {
		const change = vi.fn();
		render(<DatePicker aria-label="日期" defaultValue="2026-11-03" onChange={change} />);
		fireEvent.change(field(), { target: { value: text } });
		fireEvent.blur(field());
		expect(field().value).toBe("2026-11-03");
		expect(field().getAttribute("aria-invalid")).toBe("true");
		expect(change).not.toHaveBeenCalled();
	});

	it.each(["2026-10-14", "2026-12-01", "2026-11-08"])("越界或禁用日 %s 不提交", (text) => {
		const change = vi.fn();
		render(
			<DatePicker
				aria-label="日期"
				defaultValue="2026-11-03"
				min="2026-10-15"
				max="2026-11-30"
				disabledDate={(date) => date.getDay() === 0}
				onChange={change}
			/>,
		);
		fireEvent.change(field(), { target: { value: text } });
		fireEvent.blur(field());
		expect(field().value).toBe("2026-11-03");
		expect(change).not.toHaveBeenCalled();
	});

	it("ref/id/name/form 指向真实输入，reset 恢复默认值且不发送 change", async () => {
		const ref = createRef<HTMLInputElement>();
		const change = vi.fn();
		render(
			<>
				<form id="publish" aria-label="发布" />
				<DatePicker
					ref={ref}
					id="date"
					name="published"
					form="publish"
					aria-label="日期"
					defaultValue="2026-11-03"
					onChange={change}
				/>
			</>,
		);
		expect(ref.current).toBe(field());
		expect(document.getElementById("date")).toBe(field());
		fireEvent.change(field(), { target: { value: "2026/11/7" } });
		fireEvent.blur(field());
		const form = screen.getByRole<HTMLFormElement>("form", { name: "发布" });
		expect(new FormData(form).get("published")).toBe("2026-11-07");
		await act(async () => {
			form.reset();
		});
		expect(field().value).toBe("2026-11-03");
		expect(new FormData(form).get("published")).toBe("2026-11-03");
		expect(change).toHaveBeenCalledTimes(1);
	});

	it("取消 reset 保留值，受控提交等待宿主更新", async () => {
		const change = vi.fn();
		const { rerender } = render(
			<form aria-label="发布" onReset={(event) => event.preventDefault()}>
				<DatePicker aria-label="日期" defaultValue="2026-11-03" />
			</form>,
		);
		fireEvent.change(field(), { target: { value: "2026-11-07" } });
		fireEvent.blur(field());
		await act(async () => {
			screen.getByRole<HTMLFormElement>("form").reset();
		});
		expect(field().value).toBe("2026-11-07");
		rerender(<DatePicker aria-label="日期" value="2026-11-03" onChange={change} />);
		fireEvent.change(field(), { target: { value: "2026-11-09" } });
		fireEvent.blur(field());
		expect(change).toHaveBeenCalledWith("2026-11-09");
		expect(field().value).toBe("2026-11-03");
		rerender(<DatePicker aria-label="日期" value="2026-11-09" onChange={change} />);
		expect(field().value).toBe("2026-11-09");
	});

	it("clearable=false 不阻止空预设，包括当前已为空时的回调", () => {
		const change = vi.fn();
		render(
			<DatePicker
				aria-label="日期"
				clearable={false}
				presets={[{ label: "不限", value: "" }]}
				onChange={change}
			/>,
		);
		open();
		fireEvent.click(day("不限"));
		expect(change).toHaveBeenCalledExactlyOnceWith("");
		open();
		fireEvent.click(day("不限"));
		expect(change).toHaveBeenCalledTimes(2);
	});

	it("required 禁止清除和空预设；只读禁用不打开", () => {
		const { rerender } = render(
			<DatePicker
				aria-label="日期"
				required
				defaultValue="2026-11-03"
				presets={[{ label: "不限", value: "" }]}
			/>,
		);
		open();
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
		expect(day("不限").hasAttribute("disabled")).toBe(true);
		rerender(<DatePicker aria-label="日期" readOnly defaultValue="2026-11-03" />);
		open();
		expect(screen.queryByRole("dialog")).toBeNull();
		rerender(<DatePicker aria-label="日期" disabled defaultValue="2026-11-03" />);
		fireEvent.click(field());
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});

describe("DatePicker 面板焦点", () => {
	it("焦点在时间列里按 Esc 关闭并还给输入框，而不是掉到 body", () => {
		render(<DatePicker aria-label="日期" mode="datetime" defaultValue="2026-11-03T09:30" />);
		open();
		const hour = screen.getByRole("button", { name: "时间：时 09" });
		hour.focus();
		fireEvent.keyDown(hour, { key: "Escape" });
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(field());
	});
});

describe("DatePicker 日历与时间", () => {
	it("收起后用方向键重新打开，保留这次导航而非重置到选中日", () => {
		render(<DatePicker aria-label="日期" defaultValue="2026-11-03" />);
		open();
		fireEvent.keyDown(field(), { key: "Escape" });
		fireEvent.keyDown(field(), { key: "ArrowDown" });
		expect(
			document
				.getElementById(field().getAttribute("aria-activedescendant") ?? "")
				?.getAttribute("aria-label"),
		).toBe("2026 年 11 月 10 日 星期二");
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(field().value).toBe("2026-11-10");
	});

	it("原生左右键不被抢，周/月/年导航用活动后代并跳过禁用日", () => {
		render(
			<DatePicker
				aria-label="日期"
				defaultValue="2026-11-03"
				disabledDate={(date) => date.getDay() === 0}
			/>,
		);
		open();
		const left = new KeyboardEvent("keydown", {
			key: "ArrowLeft",
			bubbles: true,
			cancelable: true,
		});
		fireEvent(field(), left);
		expect(left.defaultPrevented).toBe(false);
		fireEvent.keyDown(field(), { key: "ArrowDown" });
		expect(
			document
				.getElementById(field().getAttribute("aria-activedescendant") ?? "")
				?.getAttribute("aria-label"),
		).toBe("2026 年 11 月 10 日 星期二");
		fireEvent.keyDown(field(), { key: "PageDown" });
		fireEvent.keyDown(field(), { key: "PageUp", shiftKey: true });
		expect(
			document
				.getElementById(field().getAttribute("aria-activedescendant") ?? "")
				?.getAttribute("aria-label"),
		).toBe("2025 年 12 月 10 日 星期三");
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(field().value).toBe("2025-12-10");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("Alt 方向键跳过禁用日，规范化的 min/max 限制导航", () => {
		render(
			<DatePicker
				aria-label="日期"
				defaultValue="2026-11-07"
				min="2026/11/1"
				max="2026.11.9"
				disabledDate={(date) => date.getDay() === 0}
			/>,
		);
		open();
		fireEvent.keyDown(field(), { key: "ArrowRight", altKey: true });
		fireEvent.keyDown(field(), { key: "ArrowRight", altKey: true });
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(field().value).toBe("2026-11-09");
	});

	it("完整日期名称、grid、已选状态与月份切换可操作", () => {
		render(<DatePicker aria-label="日期" defaultValue="2026-11-03" />);
		open();
		expect(screen.getByRole("grid", { name: "2026 年 11 月" })).toBeTruthy();
		expect(day("2026 年 11 月 3 日 星期二").getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(day("选择月份与年份"));
		fireEvent.click(day("下一年"));
		fireEvent.click(day("2027 年 2 月"));
		expect(screen.getByRole("grid", { name: "2027 年 2 月" })).toBeTruthy();
		fireEvent.click(day("2027 年 2 月 8 日 星期一"));
		expect(field().value).toBe("2027-02-08");
	});

	it("事件取消阻止打开和导航；Esc 关闭但不改已提交值", () => {
		const { rerender } = render(
			<DatePicker
				aria-label="日期"
				defaultValue="2026-11-03"
				onFocus={(event) => event.preventDefault()}
				onClick={(event) => event.preventDefault()}
			/>,
		);
		open();
		fireEvent.click(field());
		expect(screen.queryByRole("dialog")).toBeNull();
		rerender(
			<DatePicker
				aria-label="日期"
				defaultValue="2026-11-03"
				onKeyDown={(event) => {
					if (event.key === "ArrowDown") event.preventDefault();
				}}
			/>,
		);
		open();
		const active = field().getAttribute("aria-activedescendant");
		fireEvent.keyDown(field(), { key: "ArrowDown" });
		expect(field().getAttribute("aria-activedescendant")).toBe(active);
		fireEvent.keyDown(field(), { key: "Escape" });
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(field().value).toBe("2026-11-03");
	});

	it("日期时间选择日期与时分不提交，确定后一次提交", () => {
		const change = vi.fn();
		render(
			<DatePicker
				aria-label="日期"
				mode="datetime"
				defaultValue="2026-11-03T09:30"
				onChange={change}
			/>,
		);
		open();
		fireEvent.click(day("2026 年 11 月 7 日 星期六"));
		fireEvent.click(day("时间：时 12"));
		fireEvent.click(day("时间：分 45"));
		expect(change).not.toHaveBeenCalled();
		expect(screen.getByRole("dialog")).toBeTruthy();
		fireEvent.click(day("确定"));
		expect(change).toHaveBeenCalledExactlyOnceWith("2026-11-07T12:45");
		expect(field().value).toBe("2026-11-07T12:45");
	});

	it("仅时间受限小时自动选合法分钟，支持键盘步进并确定", () => {
		const change = vi.fn();
		render(
			<DatePicker aria-label="日期" mode="time" min="09:30" max="10:15" onChange={change} />,
		);
		open();
		const hours = within(screen.getByRole("group", { name: "时间：时" }));
		expect(hours.getByRole("button", { name: "时间：时 09" }).tabIndex).toBe(0);
		fireEvent.click(hours.getByRole("button", { name: "时间：时 09" }));
		fireEvent.keyDown(day("时间：分 30"), { key: "ArrowDown" });
		fireEvent.click(day("确定"));
		expect(change).toHaveBeenCalledExactlyOnceWith("09:31");
	});

	it("今天即时提交，现在暂存到确定，并遵守分钟上下界", () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 10, 8, 14, 23));
		const change = vi.fn();
		const { rerender } = render(
			<DatePicker aria-label="日期" defaultValue="2026-11-03" onChange={change} />,
		);
		open();
		fireEvent.click(day("今天"));
		expect(change).toHaveBeenLastCalledWith("2026-11-08");
		rerender(
			<DatePicker
				key="datetime"
				aria-label="日期"
				mode="datetime"
				defaultValue="2026-11-03T09:30"
				min="2026-11-08T14:20"
				max="2026-11-08T14:25"
				onChange={change}
			/>,
		);
		open();
		expect(day("2026 年 11 月 7 日 星期六").hasAttribute("disabled")).toBe(true);
		fireEvent.click(day("现在"));
		expect(change).toHaveBeenCalledTimes(1);
		expect(day("时间：分 19").hasAttribute("disabled")).toBe(true);
		expect(day("时间：分 26").hasAttribute("disabled")).toBe(true);
		fireEvent.click(day("确定"));
		expect(change).toHaveBeenLastCalledWith("2026-11-08T14:23");
	});

	it.each([
		"2026-11-07T24:00",
		"2026-11-07T12:60",
		"2026-11-07",
	])("datetime 非法草稿 %s 不替换既有值", (text) => {
		const change = vi.fn();
		render(
			<DatePicker
				aria-label="日期"
				mode="datetime"
				defaultValue="2026-11-03T09:30"
				onChange={change}
			/>,
		);
		fireEvent.change(field(), { target: { value: text } });
		fireEvent.blur(field());
		expect(field().value).toBe("2026-11-03T09:30");
		expect(change).not.toHaveBeenCalled();
	});
});
