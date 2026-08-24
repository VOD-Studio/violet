/**
 * ChatMessageContent 测试
 *
 * 覆盖聊天专属 Markdown 子集的产品决策：行内格式 + 代码块基础，不含表格/任务
 * 列表/标题；单换行保留为 <br>；Markdown 图片降级为链接；表情占位符替换与
 * 嵌套格式兼容。
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatMessageContent } from "../ChatMessageContent";

describe("ChatMessageContent", () => {
	afterEach(() => {
		cleanup();
	});

	it("渲染行内格式：粗体/斜体/删除线/行内代码/链接", () => {
		const { container } = render(
			<ChatMessageContent content="**粗体** *斜体* ~~删除线~~ `code` [链接](https://example.com)" />,
		);
		expect(container.querySelector("strong")?.textContent).toBe("粗体");
		expect(container.querySelector("em")?.textContent).toBe("斜体");
		expect(container.querySelector("del")?.textContent).toBe("删除线");
		expect(container.querySelector("code")?.textContent).toBe("code");
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("https://example.com");
		expect(link?.getAttribute("target")).toBe("_blank");
	});

	it("单换行保留为 <br>，不合并成一段（对齐 composer 的 Shift+Enter 折行）", () => {
		const { container } = render(<ChatMessageContent content={"第一行\n第二行\n第三行"} />);
		expect(container.querySelectorAll("br").length).toBe(2);
	});

	it("标题降级为加粗文本，不渲染 h1-h6", () => {
		const { container } = render(<ChatMessageContent content="# 标题" />);
		expect(container.querySelector("h1")).toBeNull();
		expect(container.querySelector("strong")?.textContent).toBe("标题");
	});

	it("不解析表格语法，保持字面文本", () => {
		const { container } = render(
			<ChatMessageContent content={"| a | b |\n| - | - |\n| 1 | 2 |"} />,
		);
		expect(container.querySelector("table")).toBeNull();
		expect(container.textContent).toContain("| a | b |");
	});

	it("不解析任务列表语法，普通列表项无 checkbox", () => {
		const { container } = render(<ChatMessageContent content="- [ ] 待办" />);
		expect(container.querySelector('input[type="checkbox"]')).toBeNull();
		expect(container.querySelector("li")?.textContent).toContain("[ ] 待办");
	});

	it("Markdown 图片语法降级为链接，不发起图片请求", () => {
		const { container } = render(
			<ChatMessageContent content="![截图](https://evil.example.com/track.png)" />,
		);
		expect(container.querySelector("img")).toBeNull();
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("https://evil.example.com/track.png");
		expect(link?.textContent).toBe("截图");
	});

	it("命中 emote 表的占位符渲染为表情图片，即使嵌在粗体内部", () => {
		const emote = { "[doge]": { url: "/uploads/emojis/doge.png" } };
		const { container } = render(
			<ChatMessageContent content="**[doge]** 你好" emote={emote} />,
		);
		expect(container.querySelector("strong img")?.getAttribute("src")).toBe(
			"/uploads/emojis/doge.png",
		);
	});
	it("自定义表情图片带 ID 与关系属性，系统表情不带自定义属性", () => {
		const emote = {
			"[mycat:emoji-1]": {
				url: "/uploads/emojis/mycat.png",
				custom_emoji_id: "emoji-1",
				relation: "none" as const,
			},
			"[doge]": { url: "/uploads/emojis/doge.png" },
		};
		const { container } = render(
			<ChatMessageContent content="[mycat:emoji-1][doge]" emote={emote} />,
		);
		const [custom, system] = container.querySelectorAll("img");
		expect(custom?.dataset.customEmojiId).toBe("emoji-1");
		expect(custom?.dataset.relation).toBe("none");
		expect(system?.dataset.customEmojiId).toBeUndefined();
	});

	it("未命中 emote 表的占位符保持字面文本", () => {
		const emote = { "[doge]": { url: "/uploads/emojis/doge.png" } };
		const { container } = render(
			<ChatMessageContent content="你好[unknown]世界" emote={emote} />,
		);
		expect(container.textContent).toContain("[unknown]");
		expect(container.querySelector("img")).toBeNull();
	});

	it("非图片 URL 的 emote（颜文字）降级为文本", () => {
		const emote = { "[颜文字]": { url: "(╯°□°）╯︵ ┻━┻" } };
		const { container } = render(<ChatMessageContent content="激动[颜文字]" emote={emote} />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toContain("(╯°□°）╯︵ ┻━┻");
	});

	it("围栏代码块渲染为 CodeCard（懒加载，带复制按钮）", async () => {
		const { container } = render(<ChatMessageContent content={"```ts\nconst a = 1;\n```"} />);
		await waitFor(() => expect(container.querySelector(".shiki-code")).toBeTruthy());
		expect(container.textContent).toContain("const a = 1;");
	});
});
