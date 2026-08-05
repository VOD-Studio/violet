import { cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTimeRangePicker } from "../components/DateTimeRangePicker";
import type { DateTimeRange } from "../types/date-time-picker-types";

function ControlledDateTimeRangePicker({
	initialValue,
	onChange,
	...rest
}: {
	initialValue?: DateTimeRange;
	onChange?: (range: DateTimeRange) => void;
} & Omit<React.ComponentProps<typeof DateTimeRangePicker>, "value" | "onChange">) {
	const [value, setValue] = React.useState<DateTimeRange>(initialValue ?? {});
	return (
		<DateTimeRangePicker
			{...rest}
			value={value}
			onChange={(next) => {
				setValue(next);
				onChange?.(next);
			}}
		/>
	);
}

describe("DateTimeRangePicker", () => {
	beforeEach(() => {
		cleanup();
		Element.prototype.scrollIntoView = vi.fn();
		global.ResizeObserver = class ResizeObserver {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	});

	it("渲染占位符", () => {
		const { container } = render(
			<DateTimeRangePicker placeholder="请选择区间" onChange={vi.fn()} />,
		);
		expect(container.textContent).toContain("请选择区间");
	});

	it("显示已选日期时间区间", () => {
		const { container } = render(
			<DateTimeRangePicker
				value={{ start: "2026-07-01T09:00", end: "2026-07-04T18:00" }}
				onChange={vi.fn()}
			/>,
		);
		expect(container.textContent).toContain("2026-07-01 09:00 至 2026-07-04 18:00");
	});

	it("选择开始和结束日期后触发 onChange 并带默认时间 00:00", () => {
		const onChange = vi.fn();
		const { container } = render(<ControlledDateTimeRangePicker onChange={onChange} />);

		const trigger = container.querySelector("button");
		expect(trigger).not.toBeNull();
		if (trigger) fireEvent.click(trigger);

		const now = new Date();
		const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
		const day1 = Array.from(document.querySelectorAll('div[data-current="true"]'))
			.find((el) => el.textContent === "1")
			?.querySelector("button");
		expect(day1).not.toBeNull();
		if (day1) fireEvent.click(day1);

		expect(onChange).toHaveBeenCalledWith({ start: `${ym}01T00:00`, end: undefined });

		const day4 = Array.from(document.querySelectorAll('div[data-current="true"]'))
			.find((el) => el.textContent === "4")
			?.querySelector("button");
		expect(day4).not.toBeNull();
		if (day4) fireEvent.click(day4);

		expect(onChange).toHaveBeenLastCalledWith({
			start: `${ym}01T00:00`,
			end: `${ym}04T00:00`,
		});
	});

	it("结束日期早于开始日期时自动交换", () => {
		const onChange = vi.fn();
		const now = new Date();
		const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
		const { container } = render(
			<ControlledDateTimeRangePicker
				initialValue={{ start: `${ym}10T00:00` }}
				onChange={onChange}
			/>,
		);

		const trigger = container.querySelector("button");
		if (trigger) fireEvent.click(trigger);

		const day5 = Array.from(document.querySelectorAll('div[data-current="true"]'))
			.find((el) => el.textContent === "5")
			?.querySelector("button");
		expect(day5).not.toBeNull();
		if (day5) fireEvent.click(day5);

		expect(onChange).toHaveBeenCalledWith({
			start: `${ym}05T00:00`,
			end: `${ym}10T00:00`,
		});
	});

	it("修改时间只更新对应端点", () => {
		const onChange = vi.fn();
		const { container } = render(
			<ControlledDateTimeRangePicker
				initialValue={{ start: "2026-07-01T09:00", end: "2026-07-04T18:00" }}
				onChange={onChange}
			/>,
		);

		const trigger = container.querySelector("button");
		if (trigger) fireEvent.click(trigger);

		// 打开开始时间的小时选择器（第一个下拉触发器）
		const triggers = document.querySelectorAll('[role="combobox"]');
		expect(triggers.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(triggers[0]);

		// 选择 08 时
		const option = Array.from(document.querySelectorAll('[role="option"]')).find(
			(el) => el.textContent === "08",
		);
		expect(option).not.toBeUndefined();
		if (option) fireEvent.click(option);

		expect(onChange).toHaveBeenCalledWith({
			start: "2026-07-01T08:00",
			end: "2026-07-04T18:00",
		});
	});

	it("清除按钮清空区间", () => {
		const onChange = vi.fn();
		const { container } = render(
			<ControlledDateTimeRangePicker
				initialValue={{ start: "2026-07-01T09:00", end: "2026-07-04T18:00" }}
				onChange={onChange}
			/>,
		);

		const trigger = container.querySelector("button");
		if (trigger) fireEvent.click(trigger);

		const clearButton = Array.from(document.querySelectorAll("button")).find((b) =>
			b.textContent?.includes("清除"),
		);
		expect(clearButton).not.toBeUndefined();
		if (clearButton) fireEvent.click(clearButton);

		expect(onChange).toHaveBeenCalledWith({ start: undefined, end: undefined });
	});

	it("快捷预设设置完整区间", () => {
		const onChange = vi.fn();
		const { container } = render(
			<DateTimeRangePicker
				value={{}}
				onChange={onChange}
				presets={[
					{
						label: "测试预设",
						value: { start: "2026-07-01T10:00", end: "2026-07-02T20:00" },
					},
				]}
			/>,
		);

		const trigger = container.querySelector("button");
		if (trigger) fireEvent.click(trigger);

		const presetButton = Array.from(document.querySelectorAll("button")).find((b) =>
			b.textContent?.includes("测试预设"),
		);
		expect(presetButton).not.toBeUndefined();
		if (presetButton) fireEvent.click(presetButton);

		expect(onChange).toHaveBeenCalledWith({
			start: "2026-07-01T10:00",
			end: "2026-07-02T20:00",
		});
	});
});
