import { describe, expect, it } from "vitest";
import { humanizeMentionTokens, mentionTokenPattern } from "../mention-token";

describe("mention tokens", () => {
	const id = "00000000-0000-0000-0000-000000000001";
	it("普通用户与全体提及混排时保留目标差异", () => {
		expect(humanizeMentionTokens(`@(all:all) @(all:${id}) @(bob:${id})`)).toBe(
			"@所有人 @all @bob",
		);
		expect([..."@(all:all)".matchAll(mentionTokenPattern())][0]?.slice(1)).toEqual([
			"all",
			"all",
		]);
	});
	it("全体目标以保留 ID 为准，其他非 UUID 目标保持原文", () => {
		expect(humanizeMentionTokens("@(renamed:all) @(all:all-other) @所有人")).toBe(
			"@所有人 @(all:all-other) @所有人",
		);
	});
});
