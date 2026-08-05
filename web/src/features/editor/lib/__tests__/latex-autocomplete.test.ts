/**
 * latex-autocomplete 纯逻辑测试
 *
 * 契约：反斜杠触发查询提取、前缀优先的过滤排序、
 * 补全替换后光标落在模板第一个占位符内。
 */
import { describe, expect, it } from "vitest";
import { KATEX_MACROS } from "@/shared/ui/katex";
import { applyCompletion, extractQuery, filterCommands } from "../latex-autocomplete";
import { LATEX_COMMANDS } from "../latex-commands";

describe("extractQuery", () => {
	it("光标紧跟 \\xxx 时提取查询", () => {
		expect(extractQuery("a + \\sqr", 8)).toEqual({ start: 4, text: "sqr" });
	});

	it("刚输入反斜杠时查询为空串", () => {
		expect(extractQuery("\\", 1)).toEqual({ start: 0, text: "" });
	});

	it("光标不在命令上下文中返回 null", () => {
		expect(extractQuery("a + b", 5)).toBeNull();
		expect(extractQuery("{x}", 2)).toBeNull();
	});

	it("光标停在命令中间也能提取（光标前段为查询）", () => {
		expect(extractQuery("\\frac{}{}", 3)).toEqual({ start: 0, text: "fr" });
	});
});

describe("filterCommands", () => {
	it("前缀匹配排在包含匹配之前", () => {
		const result = filterCommands("sqrt");
		expect(result[0]?.name).toBe("\\sqrt");
	});

	it("大小写不敏感", () => {
		const result = filterCommands("RR");
		expect(result[0]?.name).toBe("\\RR");
	});

	it("空查询返回清单前 N 项（常用优先）", () => {
		const result = filterCommands("");
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]?.name).toBe("\\frac");
	});

	it("结果数量受 limit 约束", () => {
		expect(filterCommands("a").length).toBeLessThanOrEqual(8);
		expect(filterCommands("a", 3).length).toBeLessThanOrEqual(3);
	});

	it("无匹配返回空数组", () => {
		expect(filterCommands("zzzznotacommand")).toEqual([]);
	});
});

describe("applyCompletion", () => {
	it("替换 \\query 为模板，光标落在第一个 {} 内", () => {
		const { value, cursor } = applyCompletion("a + \\fr", 7, 4, "\\frac{}{}");
		expect(value).toBe("a + \\frac{}{}");
		// 光标在 "\\frac{" 之后：4 + "\\frac{".length = 10
		expect(cursor).toBe(10);
		expect(value[cursor - 1]).toBe("{");
		expect(value[cursor]).toBe("}");
	});

	it("模板无占位符时光标落在末尾", () => {
		const { value, cursor } = applyCompletion("\\sq", 3, 0, "\\sqrt{}");
		expect(value).toBe("\\sqrt{}");
		expect(cursor).toBe(6);
	});

	it("首个占位符为 [] 时光标落在 [] 内", () => {
		const { value, cursor } = applyCompletion("\\xright", 8, 0, "\\xrightarrow[]{}");
		expect(value).toBe("\\xrightarrow[]{}");
		expect(value[cursor - 1]).toBe("[");
		expect(value[cursor]).toBe("]");
	});

	it("保留查询前后的既有内容", () => {
		const { value } = applyCompletion("x + \\sq + y", 7, 4, "\\sqrt{}");
		expect(value).toBe("x + \\sqrt{} + y");
	});
});

describe("命令清单完整性", () => {
	it("物理宏表每条宏都有补全项（防漂移）", () => {
		const names = new Set(LATEX_COMMANDS.map((c) => c.name));
		for (const macro of Object.keys(KATEX_MACROS)) {
			expect(names.has(macro)).toBe(true);
		}
	});

	it("无重复命令名", () => {
		const names = LATEX_COMMANDS.map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});
});
