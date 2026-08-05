/**
 * EmojiText 组件测试
 *
 * 验证 [name] 占位符解析与渲染：
 * - 纯文本原样输出
 * - 匹配的 emoji 渲染为 img（优先 gif_url）
 * - 未匹配的 [name] 保持原文
 * - 颜文字（非图片 URL）渲染为文本
 * - 无 emote 映射时全文原样输出
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmojiText } from "../EmojiText";

describe("EmojiText", () => {
	afterEach(() => {
		cleanup();
	});

	it("纯文本原样输出", () => {
		const { container } = render(<EmojiText text="你好世界" emote={{}} />);
		expect(container.textContent).toBe("你好世界");
	});

	it("无 emote 映射时全文原样输出", () => {
		const { container } = render(<EmojiText text="你好[doge]世界" />);
		expect(container.textContent).toBe("你好[doge]世界");
	});

	it("匹配的 emoji 渲染为 img", () => {
		const emote = {
			"[doge]": { url: "/uploads/emojis/doge.png" },
		};
		const { container } = render(<EmojiText text="[doge]" emote={emote} />);
		const img = container.querySelector("img");
		expect(img).toBeTruthy();
		expect(img?.getAttribute("src")).toBe("/uploads/emojis/doge.png");
		expect(img?.getAttribute("alt")).toBe("[doge]");
	});

	it("优先使用 gif_url", () => {
		const emote = {
			"[doge]": { url: "/uploads/emojis/doge.png", gif_url: "/uploads/emojis/doge.gif" },
		};
		const { container } = render(<EmojiText text="[doge]" emote={emote} />);
		const img = container.querySelector("img");
		expect(img?.getAttribute("src")).toBe("/uploads/emojis/doge.gif");
	});

	it("未匹配的 [name] 保持原文", () => {
		const emote = {
			"[doge]": { url: "/uploads/emojis/doge.png" },
		};
		const { container } = render(<EmojiText text="你好[unknown]世界" emote={emote} />);
		expect(container.textContent).toContain("你好");
		expect(container.textContent).toContain("[unknown]");
		expect(container.textContent).toContain("世界");
		expect(container.querySelector("img")).toBeNull();
	});

	it("混合文本与多个 emoji", () => {
		const emote = {
			"[doge]": { url: "/uploads/emojis/doge.png" },
			"[笑哭]": { url: "/uploads/emojis/laugh.png" },
		};
		const { container } = render(<EmojiText text="你好[doge]哈哈[笑哭]" emote={emote} />);
		const imgs = container.querySelectorAll("img");
		expect(imgs.length).toBe(2);
		expect(imgs[0].getAttribute("src")).toBe("/uploads/emojis/doge.png");
		expect(imgs[1].getAttribute("src")).toBe("/uploads/emojis/laugh.png");
		expect(container.textContent).toContain("你好");
		expect(container.textContent).toContain("哈哈");
	});

	it("颜文字（非图片 URL）渲染为文本", () => {
		const emote = {
			"[颜文字]": { url: "(╯°□°）╯︵ ┻━┻" },
		};
		const { container } = render(<EmojiText text="激动[颜文字]" emote={emote} />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toContain("(╯°□°）╯︵ ┻━┻");
	});
});
