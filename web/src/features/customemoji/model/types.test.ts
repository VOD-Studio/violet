import { describe, expect, it } from "vitest";
import { toMineCustomEmojis } from "./types";

describe("toMineCustomEmojis", () => {
	it("保留自传与收藏分组并附加可选关系元数据", () => {
		const result = toMineCustomEmojis({
			owned: [{ id: "owned-1", name: "mycat", url: "/mycat.png" }],
			favorited: [{ id: "favorite-1", name: "doge", url: "/doge.png" }],
		});

		expect(result.owned).toEqual([
			{
				id: -1,
				name: "mycat",
				url: "/mycat.png",
				custom_emoji_id: "owned-1",
				relation: "owned",
			},
		]);
		expect(result.favorited[0]).toMatchObject({
			name: "doge",
			url: "/doge.png",
			custom_emoji_id: "favorite-1",
			relation: "favorited",
		});
		expect(result.favorited[0].id).toBe(-2);
	});
});
