import { describe, expect, it } from "vitest";
import { toInlineEmoji } from "./inline-emoji";

describe("inline emoji projection", () => {
	it("保留系统占位符、优先动图并携带显示尺寸", () => {
		expect(
			toInlineEmoji({
				id: 1,
				name: "[smile]",
				url: "/smile.png",
				gif_url: "/smile.gif",
				meta: { size: 2 },
			}),
		).toEqual({ token: "[smile]", src: "/smile.gif", text: "[smile]", size: 2 });
	});

	it("自定义表情用独立ID序列化，颜文字使用其正文", () => {
		expect(
			toInlineEmoji({
				id: 2,
				name: "招手",
				custom_emoji_id: "custom-id",
				url: "",
				text_content: "ヾ(•ω•`)o",
			}),
		).toEqual({
			token: "[招手:custom-id]",
			src: undefined,
			text: "ヾ(•ω•`)o",
			size: undefined,
		});
	});
});
