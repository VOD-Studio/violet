/**
 * useTextareaScrollMirror 的纯函数部分单测。
 *
 * 行号↔字符 offset 换算是确定性的,可单测;镜像 div 的 DOM 量高依赖
 * 真实浏览器布局,jsdom 下不可信,不在本测试覆盖(hook 薄包装)。
 */
import { describe, expect, it } from "vitest";
import { charOffsetToLine, lineToCharOffset } from "../useTextareaScrollMirror";

describe("lineToCharOffset", () => {
	it("line=0 返回 0", () => {
		expect(lineToCharOffset("abc\ndef\nghi", 0)).toBe(0);
	});

	it("负数按 0 处理", () => {
		expect(lineToCharOffset("abc\ndef", -3)).toBe(0);
	});

	it("单行文本任意行号返回文本长度", () => {
		expect(lineToCharOffset("abc", 1)).toBe(3);
		expect(lineToCharOffset("abc", 5)).toBe(3);
	});

	it("多行文本逐行返回正确 offset", () => {
		const text = "abc\ndef\nghi";
		// line 0: 0
		// line 1: 4 ("abc\n" 后)
		// line 2: 8 ("abc\ndef\n" 后)
		// line 3: 11 (文本末尾)
		expect(lineToCharOffset(text, 0)).toBe(0);
		expect(lineToCharOffset(text, 1)).toBe(4);
		expect(lineToCharOffset(text, 2)).toBe(8);
		expect(lineToCharOffset(text, 3)).toBe(11);
	});

	it("行号超出返回文本长度", () => {
		expect(lineToCharOffset("a\nb\nc", 10)).toBe(5);
	});

	it("空行处理正确", () => {
		const text = "a\n\n\nb";
		// line 0: 0  → "a"
		// line 1: 2  → "a\n"
		// line 2: 3  → "a\n\n"
		// line 3: 4  → "a\n\n\n"
		expect(lineToCharOffset(text, 1)).toBe(2);
		expect(lineToCharOffset(text, 2)).toBe(3);
		expect(lineToCharOffset(text, 3)).toBe(4);
	});
});

describe("charOffsetToLine", () => {
	it("offset=0 返回 0", () => {
		expect(charOffsetToLine("abc\ndef", 0)).toBe(0);
	});

	it("负数按 0 处理", () => {
		expect(charOffsetToLine("abc", -5)).toBe(0);
	});

	it("offset 在第 N 个 \\n 之后返回 N", () => {
		const text = "abc\ndef\nghi";
		// offset 0-3  → line 0
		// offset 4-7  → line 1
		// offset 8-10 → line 2
		expect(charOffsetToLine(text, 2)).toBe(0);
		expect(charOffsetToLine(text, 3)).toBe(0); // \n 本身算上一行
		expect(charOffsetToLine(text, 4)).toBe(1); // \n 之后
		expect(charOffsetToLine(text, 7)).toBe(1);
		expect(charOffsetToLine(text, 8)).toBe(2);
		expect(charOffsetToLine(text, 11)).toBe(2); // 超出 clamp
	});

	it("空行连续", () => {
		const text = "a\n\n\nb";
		expect(charOffsetToLine(text, 2)).toBe(1); // 第一个 \n 后
		expect(charOffsetToLine(text, 3)).toBe(2); // 第二个 \n 后
		expect(charOffsetToLine(text, 4)).toBe(3); // 第三个 \n 后
	});
});

describe("lineToCharOffset / charOffsetToLine 往返", () => {
	it("line → offset → line 一致", () => {
		const text = "段落一\n\n## 标题\n- 列表\n```\ncode\n```";
		for (let line = 0; line <= 6; line++) {
			const offset = lineToCharOffset(text, line);
			const back = charOffsetToLine(text, offset);
			expect(back).toBe(line);
		}
	});
});
