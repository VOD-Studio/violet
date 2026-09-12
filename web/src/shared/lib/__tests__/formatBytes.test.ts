import { describe, expect, it } from "vitest";
import { formatBytes } from "../formatBytes";

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
		expect(formatBytes(1024, 0)).toBe("1 KB");
	});

	it("非有限值与负数回退到 0 B", () => {
		expect(formatBytes(Number.NaN)).toBe("0 B");
		expect(formatBytes(-100)).toBe("0 B");
	});

	it("到达最大单位后不再升档", () => {
		expect(formatBytes(Number.MAX_SAFE_INTEGER)).toMatch(/PB$/);
	});
});
