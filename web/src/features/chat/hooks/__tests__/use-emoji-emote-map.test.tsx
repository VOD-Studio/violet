import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const groups = [
	{
		id: 1,
		name: "默认",
		source: "bilibili",
		sort_order: 0,
		is_enabled: true,
		type: 2,
		emojis: [
			{ id: 1, name: "doge", url: "/uploads/emojis/doge.png" },
			{
				id: 2,
				name: "[大会员专属身份表情包_撒花]",
				url: "/uploads/emojis/member.png",
				gif_url: "/uploads/emojis/member.gif",
				meta: { size: 2 },
			},
		],
	},
];

vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: groups, isLoading: false }),
}));

import { useEmojiEmoteMap } from "../use-emoji-emote-map";

afterEach(() => cleanup());

describe("useEmojiEmoteMap", () => {
	it("普通与已带方括号的系统表情都使用单层 token 作为 key", () => {
		const { result } = renderHook(() => useEmojiEmoteMap());

		expect(result.current["[doge]"]).toMatchObject({
			url: "/uploads/emojis/doge.png",
		});
		expect(result.current["[大会员专属身份表情包_撒花]"]).toEqual({
			url: "/uploads/emojis/member.png",
			gif_url: "/uploads/emojis/member.gif",
			size: 2,
		});
		expect(result.current).not.toHaveProperty("[[大会员专属身份表情包_撒花]]");
	});
});
