import { describe, expect, it } from "vitest";
import { formatTypingLabel } from "../format-typing-label";

describe("formatTypingLabel", () => {
	it("无人输入时返回 null", () => {
		expect(formatTypingLabel([])).toBeNull();
	});

	it("单人输入时展示全名", () => {
		expect(formatTypingLabel(["张三"])).toBe("张三正在输入…");
	});

	it("两人输入时展示两个全名", () => {
		expect(formatTypingLabel(["张三", "李四"])).toBe("张三和李四正在输入…");
	});

	it("三人及以上时展示前两位全名并封顶为总人数", () => {
		expect(formatTypingLabel(["张三", "李四", "王五"])).toBe("张三、李四等 3 人正在输入…");
	});

	it("五人时仍只展示前两位全名，人数为总数", () => {
		expect(formatTypingLabel(["张三", "李四", "王五", "赵六", "钱七"])).toBe(
			"张三、李四等 5 人正在输入…",
		);
	});
});
