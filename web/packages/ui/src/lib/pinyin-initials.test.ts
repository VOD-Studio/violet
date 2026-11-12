import { describe, expect, it } from "vitest";
import { pinyinInitials } from "./pinyin-initials";

describe("pinyinInitials", () => {
	it("汉字换成拼音声母", () => {
		expect(pinyinInitials("编辑")).toBe("bj");
		expect(pinyinInitials("复制链接")).toBe("fzlj");
		expect(pinyinInitials("移动到系列")).toBe("yddxl");
		expect(pinyinInitials("移到回收站")).toBe("ydhsz");
		expect(pinyinInitials("置顶")).toBe("zd");
	});

	it("覆盖各声母的边界字（一级字表每组首字与末字）", () => {
		expect(pinyinInitials("啊座")).toBe("az");
		expect(pinyinInitials("澳芭怖擦")).toBe("abbc");
		expect(pinyinInitials("堕蛾贰发")).toBe("deef");
		expect(pinyinInitials("祸击骏喀")).toBe("hjjk");
		expect(pinyinInitials("沤啪瀑期")).toBe("oppq");
		expect(pinyinInitials("弱撒所塌唾挖")).toBe("rssttw");
		expect(pinyinInitials("误昔迅压孕匝")).toBe("wxxyyz");
	});

	it("非汉字原样保留，不含汉字时返回原文", () => {
		expect(pinyinInitials("Move to series")).toBe("Move to series");
		expect(pinyinInitials("新建系列…")).toBe("xjxl…");
		expect(pinyinInitials("Move 到系列 2")).toBe("Move dxl 2");
		expect(pinyinInitials("")).toBe("");
	});

	it("一级字表之外的字保持原样", () => {
		// 「𠮷」与繁体「編」不在 GB2312 一级字表内
		expect(pinyinInitials("編輯")).toBe("編輯");
		expect(pinyinInitials("𠮷")).toBe("𠮷");
	});

	it("多音字按字表收录的读音归类", () => {
		expect(pinyinInitials("银行")).toBe("yx");
		expect(pinyinInitials("重复")).toBe("zf");
	});
});
