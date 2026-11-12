import { afterEach, describe, expect, it } from "vitest";
import { isWindowBlank } from "../blank";

const mount = (html: string) => {
	document.body.innerHTML = html;
	return (id: string) => document.getElementById(id);
};

afterEach(() => {
	document.body.innerHTML = "";
});

describe("isWindowBlank", () => {
	it("透明的布局容器是窗", () => {
		const $ = mount(
			'<main id="main"><div id="gap" style="height:40px"></div><p id="text">正文</p></main>',
		);
		expect(isWindowBlank($("gap"))).toBe(true);
		expect(isWindowBlank($("main"))).toBe(true);
	});

	it("文字、链接、按钮与可编辑区不是窗", () => {
		const $ = mount(
			'<div><p id="p">正文</p><a id="a" href="/">链接</a><button id="b">按钮</button><div id="ce" contenteditable="true"></div><div id="t">直接写在 div 里的字</div></div>',
		);
		for (const id of ["p", "a", "b", "ce", "t"]) expect(isWindowBlank($(id))).toBe(false);
	});

	it("不透明或半透明的卡片挡住了窗", () => {
		const $ = mount(
			'<section style="background-color: rgb(255, 255, 255)"><div id="inCard"></div></section><section style="background-color: rgba(255, 255, 255, 0.8)"><div id="inGlass"></div></section><section style="background-color: rgba(0, 0, 0, 0)"><div id="inClear"></div></section>',
		);
		expect(isWindowBlank($("inCard"))).toBe(false);
		expect(isWindowBlank($("inGlass"))).toBe(false);
		expect(isWindowBlank($("inClear"))).toBe(true);
	});

	it("标了 data-window-ignore 的区域和非元素目标不是窗", () => {
		const $ = mount('<div data-window-ignore><div id="x"></div></div>');
		expect(isWindowBlank($("x"))).toBe(false);
		expect(isWindowBlank(null)).toBe(false);
		expect(isWindowBlank(window)).toBe(false);
	});
});
