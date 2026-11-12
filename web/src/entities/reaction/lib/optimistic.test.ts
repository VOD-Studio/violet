import { describe, expect, it } from "vitest";
import type { AggregatedReaction } from "../model/types";
import {
	addSelfReaction,
	captureReaction,
	removeSelfReaction,
	restoreReaction,
} from "./optimistic";

function reaction(id: number, count = 1): AggregatedReaction {
	return {
		emoji_id: id,
		emoji_name: `回应${id}`,
		emoji_url: "",
		count,
		self: true,
		recent_users: [{ id: "me", name: "我" }],
	};
}

describe("回应目标级回滚", () => {
	it("取消最后一人失败后恢复原位置，不覆盖其它回应的新数量或新增项", () => {
		const initial = [reaction(1), reaction(2), reaction(3)];
		const snapshot = captureReaction(initial, 2);
		const removed = removeSelfReaction(initial, 2, "me");
		const concurrent = [
			...removed.map((entry) => (entry.emoji_id === 1 ? { ...entry, count: 9 } : entry)),
			reaction(4),
		];
		const restored = restoreReaction(concurrent, 2, snapshot);
		expect(restored.map((entry) => entry.emoji_id)).toEqual([1, 2, 3, 4]);
		expect(restored.map((entry) => entry.count)).toEqual([9, 1, 1, 1]);
	});

	it("新增失败仅撤掉该表情，保留请求期间其它人的更新", () => {
		const initial = [reaction(1)];
		const snapshot = captureReaction(initial, 2);
		const added = addSelfReaction(
			initial,
			2,
			{ id: "me", name: "我" },
			{ id: 2, name: "喜欢", url: "" },
		);
		const concurrent = added.map((entry) =>
			entry.emoji_id === 1 ? { ...entry, count: 7 } : entry,
		);
		const restored = restoreReaction(concurrent, 2, snapshot);
		expect(restored).toEqual([{ ...initial[0], count: 7 }]);
	});
});
