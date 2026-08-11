/**
 * buildTweetCommentConfig renderBody 测试
 *
 * 契约：推文评论正文渲染表情（EmojiText 替换 [name] 为 img）与附图（ImageGrid），
 * 与文章评论同款——缺任一渲染即是回归（表情/图片是推文评论本期新增能力）。
 */

import type { TweetComment } from "@entities/tweet/model/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildTweetCommentConfig } from "../tweet-comment-config";

const author = { id: "u1", username: "alice", avatar_url: "" };

function makeComment(overrides: Partial<TweetComment> = {}): TweetComment {
	return {
		id: "c1",
		tweet_id: "t1",
		author,
		body: "[doge] 带图",
		pictures: [{ url: "/uploads/comment/a.webp", width: 100, height: 200, size: 1024 }],
		emote: { "[doge]": { url: "https://emoji/doge.png" } },
		depth: 0,
		replies_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

function buildConfig() {
	return buildTweetCommentConfig({
		tweetId: "t1",
		isLoggedIn: true,
		canDeleteAny: false,
		onDelete: () => {},
		isDeleting: () => false,
	});
}

afterEach(() => cleanup());

describe("buildTweetCommentConfig.renderBody", () => {
	it("渲染表情图片与评论附图", () => {
		const config = buildConfig();
		const item = config.map(makeComment());
		render(<>{config.renderBody?.(item)}</>);

		// 表情：[doge] 占位符替换为表情 img
		const emojiImg = screen.getByAltText("[doge]");
		expect(emojiImg.getAttribute("src")).toBe("https://emoji/doge.png");
		// 附图：ImageGrid 格子（bg 样式引用原图 / 缩略图 URL）
		const gridCells = screen.getAllByRole("button");
		expect(gridCells.length).toBeGreaterThan(0);
		expect(gridCells[0].getAttribute("style")).toContain("/uploads/comment/a.webp");
	});

	it("无图片无表情时不渲染网格", () => {
		const config = buildConfig();
		const item = config.map(makeComment({ pictures: [], emote: undefined, body: "纯文本" }));
		render(<>{config.renderBody?.(item)}</>);

		expect(screen.getByText("纯文本")).toBeTruthy();
		expect(screen.queryByRole("img")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
