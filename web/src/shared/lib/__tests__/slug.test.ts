import { describe, expect, it } from "vitest";
import { Slugger, slugify } from "../slug";

describe("slugify", () => {
	it("小写化", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("保留中文", () => {
		expect(slugify("你好世界")).toBe("你好世界");
		expect(slugify("你好 世界")).toBe("你好-世界");
	});

	it("标点折叠为单连字符", () => {
		expect(slugify("C++ 与 Rust")).toBe("c-与-rust");
		expect(slugify("100% 完成")).toBe("100-完成");
	});

	it("连续标点压缩为单个连字符", () => {
		expect(slugify("a!!!b")).toBe("a-b");
		expect(slugify("a   b")).toBe("a-b");
	});

	it("trim 首尾连字符", () => {
		expect(slugify("  hello  ")).toBe("hello");
		expect(slugify("---test---")).toBe("test");
	});

	it("保留带重音字母和希腊字母", () => {
		expect(slugify("café résumé")).toBe("café-résumé");
		expect(slugify("α β γ")).toBe("α-β-γ");
	});

	it("emoji 折叠为连字符", () => {
		expect(slugify("emoji 🎉 test")).toBe("emoji-test");
	});

	it("数字保留", () => {
		expect(slugify("2024 年度总结")).toBe("2024-年度总结");
	});

	it("空或纯标点返回空字符串", () => {
		expect(slugify("")).toBe("");
		expect(slugify("   ")).toBe("");
		expect(slugify("@#$%")).toBe("");
	});
});

describe("Slugger", () => {
	it("首次出现的 slug 原样返回", () => {
		const s = new Slugger();
		expect(s.slug("Hello")).toBe("hello");
	});

	it("重复文本追加 -1/-2", () => {
		const s = new Slugger();
		expect(s.slug("Summary")).toBe("summary");
		expect(s.slug("Summary")).toBe("summary-1");
		expect(s.slug("Summary")).toBe("summary-2");
	});

	it("不同文本互不影响", () => {
		const s = new Slugger();
		expect(s.slug("A")).toBe("a");
		expect(s.slug("B")).toBe("b");
		expect(s.slug("A")).toBe("a-1");
	});

	it("中文重复也去重", () => {
		const s = new Slugger();
		expect(s.slug("总结")).toBe("总结");
		expect(s.slug("总结")).toBe("总结-1");
	});

	it("reset 后重新从 0 计数", () => {
		const s = new Slugger();
		s.slug("X");
		s.slug("X");
		s.reset();
		expect(s.slug("X")).toBe("x");
	});

	it("与 slugify 一致(首次)", () => {
		const s = new Slugger();
		expect(s.slug("React 入门")).toBe(slugify("React 入门"));
	});
});
