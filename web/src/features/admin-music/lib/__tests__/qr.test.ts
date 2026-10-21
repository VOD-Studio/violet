import { describe, expect, it } from "vitest";
import { generateQrMatrix, generateQrSvgPath } from "../qr";

describe("qr generator", () => {
	it("为网易云登录典型 URL 生成正确的方阵", () => {
		const sampleUrl = "https://music.163.com/login?codekey=1234567890abcdef";
		const matrix = generateQrMatrix(sampleUrl);

		expect(matrix.length).toBeGreaterThan(20);
		// 必须为正方形
		for (const row of matrix) {
			expect(row.length).toBe(matrix.length);
		}

		const size = matrix.length;

		// 验证左上角寻标图案 (Finder pattern: 7x7 外框黑，次框白，内芯黑)
		expect(matrix[0]?.[0]).toBe(true);
		expect(matrix[0]?.[6]).toBe(true);
		expect(matrix[6]?.[0]).toBe(true);
		expect(matrix[6]?.[6]).toBe(true);
		expect(matrix[1]?.[1]).toBe(false);
		expect(matrix[3]?.[3]).toBe(true);

		// 右上角寻标图案
		expect(matrix[0]?.[size - 7]).toBe(true);
		expect(matrix[0]?.[size - 1]).toBe(true);
		expect(matrix[3]?.[size - 4]).toBe(true);

		// 左下角寻标图案
		expect(matrix[size - 7]?.[0]).toBe(true);
		expect(matrix[size - 1]?.[0]).toBe(true);
		expect(matrix[size - 4]?.[3]).toBe(true);
	});

	it("generateQrSvgPath 输出合法的 SVG 路径与正向尺寸", () => {
		const result = generateQrSvgPath("https://music.163.com/test", 8, 4);
		expect(result.size).toBeGreaterThan(100);
		expect(result.path.startsWith("M")).toBe(true);
		expect(result.path).toContain("h8v8h-8z");
	});

	it("极短文本可使用 Version 1 矩阵", () => {
		const matrix = generateQrMatrix("hello");
		expect(matrix.length).toBe(21); // Version 1: 17 + 4*1 = 21
	});
});
