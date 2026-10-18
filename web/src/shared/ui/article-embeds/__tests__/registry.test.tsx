import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findArticleEmbed, registerArticleEmbed } from "../registry";
import type { ArticleEmbedDefinition } from "../types";

const fence = (language: string, source: string) =>
	`<pre><code class="language-${language}">${source}</code></pre>`;

/** 测试用的嵌入：配置是 { "name": 非空字符串 }。 */
const greeting: ArticleEmbedDefinition<{ name: string }> = {
	kind: "greeting",
	languages: ["Greeting", "hello"],
	load: async () => ({
		parse: (input) =>
			typeof input === "object" &&
			input !== null &&
			typeof (input as { name?: unknown }).name === "string" &&
			(input as { name: string }).name
				? { name: (input as { name: string }).name }
				: null,
		Component: ({ config }) => <p>你好，{config.name}</p>,
	}),
};
registerArticleEmbed(greeting);

describe("文章嵌入注册表", () => {
	it("内置的五种嵌入与它们的别名都已登记，不区分大小写与首尾空白", () => {
		for (const [language, kind] of [
			["dialogue", "dialogue"],
			["chat", "dialogue"],
			["GitHub", "github"],
			["repository", "github"],
			["link-preview", "link-preview"],
			["linkcard", "link-preview"],
			["tweet", "tweet"],
			[" x ", "tweet"],
			["social-links", "social-links"],
			["socials", "social-links"],
		])
			expect(findArticleEmbed(language)?.kind).toBe(kind);
	});

	it("普通代码块的语言不是嵌入", () => {
		expect(findArticleEmbed("ts")).toBeNull();
		expect(findArticleEmbed("")).toBeNull();
	});

	it("登记新的嵌入后按它的围栏语言找到；同一份定义重复登记不报错", () => {
		expect(findArticleEmbed("HELLO")).toBe(greeting);
		expect(() => registerArticleEmbed(greeting)).not.toThrow();
	});

	it("围栏语言已经属于另一种嵌入时拒绝登记", () => {
		expect(() =>
			registerArticleEmbed({ kind: "impostor", languages: ["github"], load: greeting.load }),
		).toThrow("围栏语言「github」已经属于 github 嵌入");
	});

	it("文章里用新登记的围栏语言写的代码块按它渲染，不用改分派代码", async () => {
		render(<ArticleContent content={fence("greeting", '{"name":"瑠爱"}')} />);

		expect(await screen.findByText("你好，瑠爱")).toBeTruthy();
	});

	it("配置无效时显示可读的降级提示和原文", async () => {
		render(<ArticleContent content={fence("hello", '{"name":""}')} />);

		expect(await screen.findByText("无法解析 greeting 卡片配置")).toBeTruthy();
		expect(screen.getByText('{"name":""}')).toBeTruthy();
	});
});
