import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "../components/Calendar";
import { DateTimePicker } from "../components/DateTimePicker";
import {
    combineDateTime,
    formatPickerValue,
    formatTime,
    isDateDisabled,
    parsePickerValue,
    splitDateTime,
} from "../utils/date-time-utils";

describe("date-time-utils", () => {
    it("parsePickerValue 正确解析 datetime 字符串", () => {
        const date = parsePickerValue("2026-07-04T14:30", "datetime");
        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(6);
        expect(date?.getDate()).toBe(4);
        expect(date?.getHours()).toBe(14);
        expect(date?.getMinutes()).toBe(30);
    });

    it("parsePickerValue 对空字符串返回 null", () => {
        expect(parsePickerValue("", "datetime")).toBeNull();
    });

    it("parsePickerValue 对非法字符串返回 null", () => {
        expect(parsePickerValue("not-a-date", "datetime")).toBeNull();
    });

    it("formatPickerValue 按 date 模式输出 YYYY-MM-DD", () => {
        const formatted = formatPickerValue(new Date(2026, 6, 4, 14, 30), "date");
        expect(formatted).toBe("2026-07-04");
    });

    it("formatPickerValue 按 datetime 模式输出 YYYY-MM-DDTHH:mm", () => {
        const formatted = formatPickerValue(new Date(2026, 6, 4, 14, 30), "datetime");
        expect(formatted).toBe("2026-07-04T14:30");
    });

    it("formatPickerValue 按 time 模式输出 HH:mm", () => {
        const formatted = formatPickerValue(new Date(2026, 6, 4, 14, 30), "time");
        expect(formatted).toBe("14:30");
    });

    it("splitDateTime 拆分 datetime 为日期和时间", () => {
        const result = splitDateTime("2026-07-04T14:30", "datetime");
        expect(result.date).not.toBeNull();
        expect(result.time).toBe("14:30");
    });

    it("combineDateTime 合并日期和时间", () => {
        expect(combineDateTime("2026-07-04", "14:30")).toBe("2026-07-04T14:30");
    });

    it("isDateDisabled 对早于 minDate 的日期返回 true", () => {
        const minDate = new Date(2026, 6, 4);
        expect(isDateDisabled(new Date(2026, 6, 3), { minDate })).toBe(true);
        expect(isDateDisabled(new Date(2026, 6, 5), { minDate })).toBe(false);
    });

    it("isDateDisabled 对晚于 maxDate 的日期返回 true", () => {
        const maxDate = new Date(2026, 6, 4);
        expect(isDateDisabled(new Date(2026, 6, 5), { maxDate })).toBe(true);
        expect(isDateDisabled(new Date(2026, 6, 3), { maxDate })).toBe(false);
    });

    it("isDateDisabled 支持自定义 disabledDate", () => {
        const disabledDate = (d: Date) => d.getDay() === 0;
        expect(isDateDisabled(new Date(2026, 6, 5), { disabledDate })).toBe(true); // 周日
        expect(isDateDisabled(new Date(2026, 6, 6), { disabledDate })).toBe(false); // 周一
    });

    it("formatTime 格式化为 HH:mm", () => {
        expect(formatTime(new Date(2026, 6, 4, 9, 5))).toBe("09:05");
    });
});

describe("DateTimePicker", () => {
    it("datetime 模式渲染占位符", () => {
        const { container } = render(
            <DateTimePicker value="" placeholder="请选择" onChange={vi.fn()} />,
        );
        expect(container.textContent).toContain("请选择");
    });

    it("datetime 模式显示格式化后的日期时间", () => {
        const { container } = render(
            <DateTimePicker value="2026-07-04T14:30" onChange={vi.fn()} />,
        );
        expect(container.textContent).toContain("2026-07-04 14:30");
    });

    it("date 模式显示格式化后的日期", () => {
        const { container } = render(
            <DateTimePicker value="2026-07-04" mode="date" onChange={vi.fn()} />,
        );
        expect(container.textContent).toContain("2026-07-04");
    });

    it("time 模式显示格式化后的时间", () => {
        const { container } = render(
            <DateTimePicker value="14:30" mode="time" onChange={vi.fn()} />,
        );
        expect(container.textContent).toContain("14:30");
    });

    it("渲染并触发 presets", () => {
        const onChange = vi.fn();
        const { container } = render(
            <DateTimePicker
                value=""
                mode="datetime"
                onChange={onChange}
                presets={[{ label: "测试预设", value: "2026-07-04T10:00" }]}
            />,
        );
        const trigger = container.querySelector("button");
        expect(trigger).not.toBeNull();
        if (trigger) fireEvent.click(trigger);
        expect(document.body.textContent).toContain("测试预设");

        const presetButton = Array.from(document.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("测试预设"),
        );
        expect(presetButton).not.toBeUndefined();
        if (presetButton) fireEvent.click(presetButton);
        expect(onChange).toHaveBeenCalledWith("2026-07-04T10:00");
    });
});

describe("Calendar", () => {
    it("默认周一作为每周起始日", () => {
        const { container } = render(<Calendar selected={null} />);
        const headers = container.querySelectorAll(".grid-cols-7 > div");
        expect(headers[0]?.textContent).toBe("一");
        expect(headers[6]?.textContent).toBe("日");
    });

    it("weekStartsOn=0 时周日作为每周起始日", () => {
        const { container } = render(<Calendar selected={null} weekStartsOn={0} />);
        const headers = container.querySelectorAll(".grid-cols-7 > div");
        expect(headers[0]?.textContent).toBe("日");
        expect(headers[1]?.textContent).toBe("一");
    });

    it("区间选择时高亮起始、结束和区间内日期", () => {
        const start = new Date(2026, 6, 1);
        const end = new Date(2026, 6, 5);
        const { container } = render(
            <Calendar selected={null} range={{ start, end }} month={new Date(2026, 6, 1)} />,
        );

        const cells = Array.from(
            container.querySelectorAll('div[data-current="true"]'),
        ) as HTMLDivElement[];

        const startCell = cells.find((b) => b.textContent === "1");
        const endCell = cells.find((b) => b.textContent === "5");
        const innerCell = cells.find((b) => b.textContent === "3");

        expect(startCell?.className).toContain("rounded-l-md");
        expect(endCell?.className).toContain("rounded-r-md");
        expect(innerCell?.className).toContain("bg-primary/20");
    });

    it("跨月区间也会高亮上下月的补齐日期", () => {
        const start = new Date(2026, 5, 28); // 6月28日
        const end = new Date(2026, 6, 5); // 7月5日
        const { container } = render(
            <Calendar selected={null} range={{ start, end }} month={new Date(2026, 6, 1)} />,
        );

        const cells = Array.from(
            container.querySelectorAll(".grid-cols-7 > div"),
        ) as HTMLDivElement[];

        const endCell = cells.find((el) => el.textContent?.trim() === "5");
        const prevMonthCell = cells.find((el) => el.textContent?.trim() === "30");

        expect(endCell?.className).toContain("rounded-r-md");
        expect(prevMonthCell?.className).toContain("bg-primary/20");
    });
});
