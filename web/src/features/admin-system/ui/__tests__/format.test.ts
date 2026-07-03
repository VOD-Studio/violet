import { describe, expect, it } from "vitest";
import {
    formatBytes,
    formatLatency,
    formatNsToMs,
    formatPercent,
    formatRate,
    formatUptime,
    thresholdColor,
} from "../format";

describe("formatBytes", () => {
    it("小于 1024 时保留原始字节单位", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(1023)).toBe("1023 B");
    });

    it("按二进制阶梯换算到合适单位", () => {
        expect(formatBytes(1024)).toBe("1.0 KB");
        expect(formatBytes(1048576)).toBe("1.0 MB");
        expect(formatBytes(1073741824)).toBe("1.0 GB");
    });

    it("保留指定小数位", () => {
        expect(formatBytes(1536, 2)).toBe("1.50 KB");
        // toFixed(0) 走四舍五入：1024B = 1.0 KB，舍入后为 1
        expect(formatBytes(1024, 0)).toBe("1 KB");
    });

    it("非有限值与负数回退到 0 B", () => {
        expect(formatBytes(Number.NaN)).toBe("0 B");
        expect(formatBytes(-100)).toBe("0 B");
    });

    it("到达最大单位后不再升档", () => {
        // PB 上限：超大值不再升到 EB
        expect(formatBytes(Number.MAX_SAFE_INTEGER)).toMatch(/PB$/);
    });
});

describe("formatRate", () => {
    it("追加 /s 后缀", () => {
        expect(formatRate(1024)).toBe("1.0 KB/s");
        expect(formatRate(1572864)).toBe("1.5 MB/s");
    });
});

describe("formatPercent", () => {
    it("保留指定小数位并加 %", () => {
        expect(formatPercent(42)).toBe("42.0%");
        expect(formatPercent(42.56, 2)).toBe("42.56%");
    });

    it("非有限值返回 0%", () => {
        expect(formatPercent(Number.NaN)).toBe("0%");
    });
});

describe("formatLatency", () => {
    it("正常值加 ms 后缀", () => {
        expect(formatLatency(0)).toBe("0ms");
        expect(formatLatency(12)).toBe("12ms");
    });

    it("非有限值与负数返回 -", () => {
        expect(formatLatency(Number.NaN)).toBe("-");
        expect(formatLatency(-1)).toBe("-");
    });
});

describe("formatUptime", () => {
    it("不足 1 分钟返回 <1m", () => {
        expect(formatUptime(0)).toBe("<1m");
        expect(formatUptime(30)).toBe("<1m");
    });

    it("分钟级显示为 Yh Zm", () => {
        // 1 小时 = 3600 秒
        expect(formatUptime(3600)).toBe("1h 0m");
        // 1 小时 30 分 = 5400 秒
        expect(formatUptime(5400)).toBe("1h 30m");
    });

    it("天级显示为 Xd Yh", () => {
        // 1 天 + 2 小时 = 93600 秒
        expect(formatUptime(93600)).toBe("1d 2h");
    });

    it("非有限值与负数返回 -", () => {
        expect(formatUptime(Number.NaN)).toBe("-");
        expect(formatUptime(-5)).toBe("-");
    });
});

describe("formatNsToMs", () => {
    it("纳秒换算为毫秒并保留 2 位", () => {
        expect(formatNsToMs(1_000_000)).toBe("1.00ms");
        expect(formatNsToMs(1_500_000)).toBe("1.50ms");
    });

    it("非有限值与负数返回 0ms", () => {
        expect(formatNsToMs(Number.NaN)).toBe("0ms");
        expect(formatNsToMs(-100)).toBe("0ms");
    });
});

describe("thresholdColor", () => {
    it(">85% 返回红色", () => {
        expect(thresholdColor(86)).toBe("var(--destructive)");
        expect(thresholdColor(100)).toBe("var(--destructive)");
    });

    it("60-85% 返回警示色", () => {
        expect(thresholdColor(61)).toBe("var(--chart-4)");
        expect(thresholdColor(85)).toBe("var(--chart-4)");
    });

    it("<=60% 返回健康色", () => {
        expect(thresholdColor(60)).toBe("var(--chart-2)");
        expect(thresholdColor(0)).toBe("var(--chart-2)");
    });
});
