import { describe, expect, it } from "vitest";
import { toEmojiToken } from "./token";

describe("toEmojiToken", () => {
	it("为自定义表情追加 ID", () => {
		expect(
			toEmojiToken({
				id: -1,
				name: "mycat",
				url: "/mycat.png",
				custom_emoji_id: "emoji-1",
				relation: "owned",
			}),
		).toBe("[mycat:emoji-1]");
	});

	it("保留已带方括号的系统表情名称", () => {
		expect(toEmojiToken({ id: 1, name: "[doge]", url: "/doge.png" })).toBe("[doge]");
	});

	it("为普通系统表情名称补方括号", () => {
		expect(toEmojiToken({ id: 2, name: "doge", url: "/doge.png" })).toBe("[doge]");
	});
});
