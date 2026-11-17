import { describe, expect, it } from "vitest";
import { classifyChatLink, collectChatLinks } from "../chat-links";

describe("collectChatLinks", () => {
	it.each([
		"chat",
		"bot",
	] as const)("%s 遵循 Markdown 结构，不读取代码与图片中的 URL", (variant) => {
		const links = collectChatLinks(
			[
				"`https://example.com/inline`",
				"```txt\nhttps://example.com/fenced\n```",
				"    https://example.com/indented",
				"![图片](https://example.com/image.png)",
				"[网站](https://example.com/page)",
				"https://github.com/VOD-Studio/violet",
			].join("\n\n"),
			variant,
		);
		expect(links.map((link) => link.href)).toEqual([
			"https://example.com/page",
			"https://github.com/VOD-Studio/violet",
		]);
	});

	it("引用链接解析定义，未引用的定义不生成卡片", () => {
		expect(
			collectChatLinks(
				"[文档][DOC]\n\n[doc]: https://example.com/doc\n[unused]: https://example.com/unused",
			),
		).toEqual([
			{ kind: "web", href: "https://example.com/doc", key: "https://example.com/doc" },
		]);
	});

	it("规范 URL 去重，同时保留第一个原链接的锚点", () => {
		const links = collectChatLinks(
			"https://EXAMPLE.com:443/page#first https://example.com/page#second",
		);
		expect(links).toHaveLength(1);
		expect(links[0].href).toBe("https://EXAMPLE.com:443/page#first");
	});

	it("优先识别 GitHub 和推文，X/Twitter 别名与跟踪参数不重复展示", () => {
		const links = collectChatLinks(
			[
				"https://github.com/VOD-Studio/violet",
				"https://github.com/vod-studio/Violet/?tab=readme",
				"https://twitter.com/jack/status/20?s=1",
				"https://x.com/i/web/status/20/photo/1",
				"https://example.com",
			].join("\n"),
		);
		expect(links.map((link) => link.kind)).toEqual(["github", "tweet", "web"]);
		expect(links[1].href).toBe("https://twitter.com/jack/status/20?s=1");
	});

	it("不把伪造主机、作者页、错误推文路径当成真实推文", () => {
		for (const url of [
			"https://x.com.evil.com/jack/status/20",
			"https://x.com/jack",
			"https://x.com/jack/status/nope",
			"https://github.com/VOD-Studio",
		]) {
			expect(classifyChatLink(url)?.kind).toBe("web");
		}
		for (const url of [
			"javascript:alert(1)",
			"file:///tmp/a",
			"https://user:password@github.com/VOD-Studio/violet",
			"//github.com/VOD-Studio/violet",
		]) {
			expect(classifyChatLink(url)).toBeNull();
		}
	});
});
