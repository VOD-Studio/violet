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
	it("自定义表情图片带 ID 与关系属性，系统表情不带自定义属性", () => {
		const emote = {
			"[mycat:emoji-1]": {
				url: "/uploads/emojis/mycat.png",
				custom_emoji_id: "emoji-1",
				relation: "favorited" as const,
			},
			"[doge]": { url: "/uploads/emojis/doge.png" },
		};
		const { container } = render(<EmojiText text="[mycat:emoji-1][doge]" emote={emote} />);
		const [custom, system] = container.querySelectorAll("img");
		expect(custom?.dataset.customEmojiId).toBe("emoji-1");
		expect(custom?.dataset.relation).toBe("favorited");
		expect(system?.dataset.customEmojiId).toBeUndefined();
		expect(system?.dataset.relation).toBeUndefined();
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

	describe("表情尺寸", () => {
		const custom = { url: "/c.png", custom_emoji_id: "c1" };
		const system = { url: "/s.png" };

		it("自定义表情内联时比系统表情大", () => {
			const { container } = render(
				<EmojiText
					text="看[cat]和[smile]"
					emote={{ "[cat]": custom, "[smile]": system }}
				/>,
			);
			const [cat, smile] = container.querySelectorAll("img");
			expect(cat.className).toContain("size-9");
			expect(smile.className).toContain("size-5");
		});

		it("整条只由表情组成时放大成表情包，大表情再放大一档", () => {
			const { container } = render(
				<EmojiText text="[cat]" emote={{ "[cat]": { ...custom, size: 2 } }} />,
			);
			expect(container.querySelector("img")?.className).toContain("size-24");
			const small = render(<EmojiText text="[cat]" emote={{ "[cat]": custom }} />);
			expect(small.container.querySelector("img")?.className).toContain("size-16");
		});

		it("表情夹在文字里或超过 4 个时不按表情包放大", () => {
			const emote = { "[cat]": custom };
			const mixed = render(<EmojiText text="好[cat]" emote={emote} />);
			expect(mixed.container.querySelector("img")?.className).toContain("size-9");
			const many = render(<EmojiText text="[cat][cat][cat][cat][cat]" emote={emote} />);
			expect(many.container.querySelector("img")?.className).toContain("size-9");
		});
	});
});
