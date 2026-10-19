/**
 * 手册覆盖漂移测试：编辑器功能面从代码枚举（Slash 项、工具栏项、提示块类型、
 * KaTeX 宏表、图块格式、已登记的卡片围栏与它们的 Slash 入口），断言手册对应章节有记载。新增能力未同步
 * 文档时在此红灯，登记处见 SLASH_DOC_KEYWORD / TOOLBAR_DOC_KEYWORD。
 */
import "@/register-article-embeds";
import { listArticleEmbeds } from "@shared/ui/article-embeds";
import { diagramRenderers } from "@shared/ui/diagram/renderers";
import { KATEX_MACROS } from "@shared/ui/katex/katex-core";
import { describe, expect, it } from "vitest";
import { ALERT_TYPES } from "../extensions/alert";
import { buildEmbedSlashItems, buildSlashItems } from "../slash-menu/slash-items";
import { blockItems, formatItems } from "../toolbar/toolbar-items";
import diagram from "./diagram.md?raw";
import math from "./math.md?raw";
import personaCards from "./persona-cards.md?raw";
import readme from "./README.md?raw";
import storage from "./storage.md?raw";
import syntax from "./syntax.md?raw";

/** Slash 项 id → 基础语法章节中的记载关键词；新增 Slash 项须在此登记 */
const SLASH_DOC_KEYWORD: Record<string, string> = {
	text: "正文",
	h1: "标题",
	h2: "标题",
	h3: "标题",
	footnote: "脚注",
	bulletList: "无序列表",
	orderedList: "有序列表",
	taskList: "任务列表",
	blockquote: "引用",
	details: "折叠块",
	codeBlock: "代码块",
	runnableCodeBlock: "可运行代码块",
	hr: "分割线",
	table: "表格",
	inlineMath: "行内公式",
	blockMath: "公式块",
	image: "图片",
	diagramBlock: "流程图",
};

/** 工具栏项 id → 基础语法章节中的记载关键词；新增工具栏项须在此登记 */
const TOOLBAR_DOC_KEYWORD: Record<string, string> = {
	bold: "加粗",
	italic: "斜体",
	underline: "下划线",
	strike: "删除线",
	subscript: "下标",
	superscript: "上标",
	code: "行内代码",
	highlight: "高亮",
	bulletList: "无序列表",
	orderedList: "有序列表",
	taskList: "任务列表",
	blockquote: "引用",
	unsetAlert: "解除提示块",
	details: "折叠块",
	codeBlock: "代码块",
	hr: "分割线",
	table: "表格",
};

const CHAPTER_FILES = ["syntax", "math", "diagram", "persona-cards", "storage"];

describe("编辑器手册漂移测试", () => {
	it("Slash 菜单每项都在基础语法章节有记载", () => {
		const unmapped: string[] = [];
		for (const item of buildSlashItems(() => {})) {
			// 提示块项由 ALERT_TYPES 用例单独覆盖
			if (item.id.startsWith("alert-")) continue;
			const keyword = SLASH_DOC_KEYWORD[item.id];
			if (!keyword) {
				unmapped.push(item.id);
				continue;
			}
			expect(syntax, `Slash「${item.title}」(${item.id}) 未在 syntax.md 记载`).toContain(
				keyword,
			);
		}
		expect(unmapped, "新增 Slash 项须先在 SLASH_DOC_KEYWORD 登记文档关键词").toEqual([]);
	});

	it("提示块类型与 ALERT_TYPES 一致", () => {
		for (const type of ALERT_TYPES) {
			expect(syntax, `提示块 ${type} 未在 syntax.md 记载`).toContain(`[!${type}]`);
		}
	});

	it("工具栏项在基础语法章节有记载", () => {
		const unmapped: string[] = [];
		for (const item of [...formatItems, ...blockItems]) {
			const keyword = TOOLBAR_DOC_KEYWORD[item.id];
			if (!keyword) {
				unmapped.push(item.id);
				continue;
			}
			expect(syntax, `工具栏「${item.title}」(${item.id}) 未在 syntax.md 记载`).toContain(
				keyword,
			);
		}
		expect(unmapped, "新增工具栏项须先在 TOOLBAR_DOC_KEYWORD 登记文档关键词").toEqual([]);
		expect(syntax, "对齐组未记载").toContain("两端");
		expect(syntax, "撤销重做未记载").toContain("撤销重做");
	});

	it("物理宏表覆盖 KATEX_MACROS 全部键", () => {
		for (const key of Object.keys(KATEX_MACROS)) {
			expect(math, `宏 ${key} 未在 math.md 宏表记载`).toContain(key);
		}
	});

	it("图块注册表每种格式在图块章节有围栏示例", () => {
		for (const format of Object.keys(diagramRenderers)) {
			expect(diagram, `图块格式 ${format} 未在 diagram.md 记载`).toContain(`\`\`\`${format}`);
		}
	});

	it("每种语义卡片围栏在人物章节有示例", () => {
		for (const { kind, languages } of listArticleEmbeds()) {
			const documented = languages.some((lang) => personaCards.includes(`\`\`\`${lang}`));
			expect(
				documented,
				`卡片类型 ${kind} 的围栏（${languages.join("/")}）未在 persona-cards.md 示例`,
			).toBe(true);
		}
	});

	it("Slash 菜单「嵌入」组的每项在基础语法章节有记载", () => {
		for (const item of buildEmbedSlashItems(() => {}))
			expect(syntax, `Slash「${item.title}」(${item.id}) 未在 syntax.md 记载`).toContain(
				item.title,
			);
	});

	it("README 链接全部章节且互链目标存在", () => {
		for (const file of CHAPTER_FILES) {
			expect(readme, `README 缺少 ${file} 章节链接`).toContain(`(./${file}.md)`);
		}
		const all = [readme, syntax, math, diagram, personaCards, storage].join("\n");
		for (const match of all.matchAll(/\]\(\.\/([\w-]+)\.md\)/g)) {
			// README（手册索引）与五章正文都是合法互链目标
			expect([...CHAPTER_FILES, "README"], `互链目标 ${match[0]} 不是已登记章节`).toContain(
				match[1],
			);
		}
	});

	it("可运行代码块的载体契约在存储章节有记载", () => {
		expect(storage, "HTML 载体属性未记载").toContain("data-runnable");
		expect(storage, "info string 标记未记载").toContain("runnable");
	});
});
