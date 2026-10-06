import { describe, expect, it } from "vitest";
import { parseViewBoxSize, serializeSvg } from "../export";

describe("serializeSvg", () => {
	it("注入 XML 声明与 SVG 命名空间（缺失时补全）", () => {
		const result = serializeSvg("<svg><rect/></svg>");
		expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(result).toContain("<rect/>");
	});

	it("已有 xmlns 时不重复注入", () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
		const result = serializeSvg(svg);
		const xmlnsCount = (result.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) ?? []).length;
		expect(xmlnsCount).toBe(1);
	});

	it("保留已有属性（viewBox、width、height）", () => {
		const svg = '<svg viewBox="0 0 400 300" width="400" height="300"><rect/></svg>';
		const result = serializeSvg(svg);
		expect(result).toContain('viewBox="0 0 400 300"');
		expect(result).toContain('width="400"');
	});
});

describe("parseViewBoxSize", () => {
	it("从 viewBox 提取宽高", () => {
		expect(parseViewBoxSize('<svg viewBox="0 0 640 480">')).toEqual({
			width: 640,
			height: 480,
		});
	});

	it("从 width/height 属性提取", () => {
		expect(parseViewBoxSize('<svg width="200" height="100">')).toEqual({
			width: 200,
			height: 100,
		});
	});

	it("viewBox 优先于 width/height", () => {
		expect(parseViewBoxSize('<svg viewBox="0 0 800 600" width="200" height="100">')).toEqual({
			width: 800,
			height: 600,
		});
	});
});
