import { fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../components/DateRangePicker";
import type { DateRange } from "../types/date-time-picker-types";

function ControlledDateRangePicker({
    initialValue,
    onChange,
    ...rest
}: {
    initialValue?: DateRange;
    onChange?: (range: DateRange) => void;
} & Omit<React.ComponentProps<typeof DateRangePicker>, "value" | "onChange">) {
    const [value, setValue] = React.useState<DateRange>(initialValue ?? {});
    return (
        <DateRangePicker
            {...rest}
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

describe("DateRangePicker", () => {
    it("渲染占位符", () => {
        const { container } = render(
            <DateRangePicker placeholder="请选择区间" onChange={vi.fn()} />,
        );
        expect(container.textContent).toContain("请选择区间");
    });

    it("显示已选区间", () => {
        const { container } = render(
            <DateRangePicker
                value={{ start: "2026-07-01", end: "2026-07-04" }}
                onChange={vi.fn()}
            />,
        );
        expect(container.textContent).toContain("2026-07-01 至 2026-07-04");
    });

    it("选择开始和结束日期后触发 onChange", () => {
        const onChange = vi.fn();
        const { container } = render(<ControlledDateRangePicker onChange={onChange} />);

        const trigger = container.querySelector("button");
        expect(trigger).not.toBeNull();
        if (trigger) fireEvent.click(trigger);

        // 打开面板后选择 7月1日
        const day1 = Array.from(document.querySelectorAll('button[data-current="true"]')).find(
            (b) => b.textContent === "1",
        );
        expect(day1).not.toBeUndefined();
        if (day1) fireEvent.click(day1);

        expect(onChange).toHaveBeenCalledWith({ start: "2026-07-01", end: undefined });

        // 面板仍打开，选择结束日期 7月4日
        const day4 = Array.from(document.querySelectorAll('button[data-current="true"]')).find(
            (b) => b.textContent === "4",
        );
        expect(day4).not.toBeUndefined();
        if (day4) fireEvent.click(day4);

        expect(onChange).toHaveBeenLastCalledWith({
            start: "2026-07-01",
            end: "2026-07-04",
        });
    });

    it("结束日期早于开始日期时自动交换", () => {
        const onChange = vi.fn();
        const { container } = render(
            <ControlledDateRangePicker
                initialValue={{ start: "2026-07-10" }}
                onChange={onChange}
            />,
        );

        const trigger = container.querySelector("button");
        if (trigger) fireEvent.click(trigger);

        const day5 = Array.from(document.querySelectorAll('button[data-current="true"]')).find(
            (b) => b.textContent === "5",
        );
        expect(day5).not.toBeUndefined();
        if (day5) fireEvent.click(day5);

        expect(onChange).toHaveBeenCalledWith({
            start: "2026-07-05",
            end: "2026-07-10",
        });
    });

    it("清除按钮清空区间", () => {
        const onChange = vi.fn();
        const { container } = render(
            <ControlledDateRangePicker
                initialValue={{ start: "2026-07-01", end: "2026-07-04" }}
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
});
