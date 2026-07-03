import { describe, expect, it } from "vitest";
import { fmtBytes, fmtPercent, fmtUptime, thresholdColor } from "./format";

describe("fmtBytes", () => {
    it("0 字节", () => {
        expect(fmtBytes(0)).toBe("0 B");
    });
    it("KB", () => {
        expect(fmtBytes(1024)).toBe("1.0 KB");
    });
    it("MB", () => {
        expect(fmtBytes(1024 * 1024 * 512)).toBe("512.0 MB");
    });
    it("GB", () => {
        expect(fmtBytes(1024 ** 3 * 2)).toBe("2.0 GB");
    });
});

describe("fmtPercent", () => {
    it("保留一位小数", () => {
        expect(fmtPercent(42.56)).toBe("42.6%");
    });
});

describe("fmtUptime", () => {
    it("分钟", () => {
        expect(fmtUptime(300)).toBe("5m");
    });
    it("小时+分", () => {
        expect(fmtUptime(3600 * 2 + 60)).toBe("2h 1m");
    });
    it("天+时", () => {
        expect(fmtUptime(86400 * 3 + 3600 * 2)).toBe("3d 2h");
    });
});

describe("thresholdColor", () => {
    it("低于 60% 返回绿色", () => {
        expect(thresholdColor(40)).toBe("var(--chart-2)");
    });
    it("60-85% 返回金色", () => {
        expect(thresholdColor(70)).toBe("var(--chart-4)");
    });
    it("高于 85% 返回红色", () => {
        expect(thresholdColor(90)).toBe("var(--destructive)");
    });
});
