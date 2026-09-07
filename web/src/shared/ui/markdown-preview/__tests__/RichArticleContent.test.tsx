import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const profile = {
	name: "若菫瑠爱｜RUA",
	subtitle: "信息设计专业",
	description: "她习惯在开口前先认真想清楚。",
	avatarUrl: "/avatar.webp",
	href: "/persona",
};

function fence(language: string, config: unknown): string {
	return `<pre><code class="language-${language}">${JSON.stringify(config)}</code></pre>`;
}

describe("ArticleContent rich nodes", () => {
	it("将行内 persona 标记渲染为可聚焦人物档案", async () => {
		render(
			<ArticleContent
				content="<p>今天由 <code>persona:瑠爱</code> 带路。</p>"
				context={{ profile }}
			/>,
		);

		const mention = await screen.findByRole("link", { name: "瑠爱" });
		expect(mention.getAttribute("href")).toBe("/persona");
		fireEvent.focus(mention);
		expect(await screen.findByText(profile.description)).toBeTruthy();
	});

	it("从 HTML 主路径解析对话、仓库、链接、动态与社交卡片", async () => {
		const html = [
			fence("dialogue", {
				text: "那个……要一起看球吗？",
				profile: "active",
				side: "left",
			}),
			fence("github", {
				repo: "VOD-Studio/violet",
				description: "个人创作与读者社区",
				language: "TypeScript",
				stars: 128,
			}),
			fence("link-preview", {
				url: "https://example.com/about",
				title: "关于这座花园",
				description: "一份缓慢生长的个人档案。",
				site: "example.com",
			}),
			fence("tweet", {
				url: "https://x.com/example/status/1",
				author: "Rua",
				handle: "@rua",
				text: "月光刚好落在书页上。",
			}),
			fence("social-links", {
				links: [
					{
						label: "GitHub",
						href: "https://github.com/VOD-Studio",
						handle: "VOD-Studio",
					},
					{ label: "来信", href: "mailto:hello@example.com", icon: "email" },
				],
			}),
		].join("");
		render(<ArticleContent content={html} context={{ profile }} />);

		expect(await screen.findByText("那个……要一起看球吗？")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "打开 GitHub 仓库 VOD-Studio/violet" }),
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "打开链接：关于这座花园" })).toBeTruthy();
		expect(screen.getByRole("article", { name: "Rua 发布的动态" })).toBeTruthy();
		expect(screen.getByRole("navigation", { name: "社交链接" })).toBeTruthy();
	});

	it("从 Markdown 降级路径解析行内人物与围栏卡片", async () => {
		const markdown = [
			"今天由 `persona:瑠爱` 维护。",
			"",
			"```github",
			JSON.stringify({ repo: "VOD-Studio/violet", description: "公开仓库" }),
			"```",
		].join("\n");
		render(<ArticleContent content={markdown} context={{ profile }} />);

		expect(await screen.findByRole("link", { name: "瑠爱" })).toBeTruthy();
		expect(
			await screen.findByRole("link", {
				name: "打开 GitHub 仓库 VOD-Studio/violet",
			}),
		).toBeTruthy();
	});

	it("拒绝危险链接并保留可诊断降级", async () => {
		const html = fence("link-preview", {
			url: "javascript:alert(1)",
			title: "危险链接",
		});
		render(<ArticleContent content={html} />);

		expect(await screen.findByText("无法解析 link-preview 卡片配置")).toBeTruthy();
		expect(screen.queryByRole("link", { name: /危险链接/u })).toBeNull();
	});
});
