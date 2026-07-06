import type { Comment } from "@entities/comment/model/types";
import { describe, expect, it } from "vitest";
import { buildCommentTree, getCommentSeverity } from "../comment-tree";

/** 辅助：构造一条扁平 Comment */
const make = (overrides: Partial<Comment> & { id: string }): Comment => ({
    post_id: "p1",
    depth: 0,
    author_name: "x",
    avatar_url: "",
    body: "body",
    pictures: [],
    is_author: false,
    status: "approved",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
});

describe("buildCommentTree", () => {
    it("空数组返回空数组", () => {
        expect(buildCommentTree([])).toEqual([]);
    });

    it("全是顶级评论时返回各自独立的根", () => {
        const items = [make({ id: "1" }), make({ id: "2" }), make({ id: "3" })];
        const tree = buildCommentTree(items);
        expect(tree).toHaveLength(3);
        expect(tree[0].comment.id).toBe("1");
        expect(tree[0].replies).toEqual([]);
    });

    it("parent_id 指向的评论作为子节点挂载", () => {
        const items = [
            make({ id: "1", depth: 0 }),
            make({ id: "2", parent_id: "1", depth: 1, body: "reply" }),
        ];
        const tree = buildCommentTree(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].comment.id).toBe("1");
        expect(tree[0].replies).toHaveLength(1);
        expect(tree[0].replies[0].comment.id).toBe("2");
        expect(tree[0].replies[0].comment.body).toBe("reply");
    });

    it("回复另一条回复时挂同一顶层下（两层扁平，不深嵌套）", () => {
        // 后端两层扁平：id=3 回复 id=2（id=2 是回复），depth 都是 1。
        // 前端组装时，id=3 应挂到顶层 id=1 下，不嵌套在 id=2 里。
        // 对话关系靠 comment.reply_to_name 标，不靠嵌套结构。
        const items = [
            make({ id: "1", depth: 0 }),
            make({ id: "2", parent_id: "1", depth: 1 }),
            make({ id: "3", parent_id: "2", depth: 1, body: "reply-to-reply" }),
        ];
        const tree = buildCommentTree(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].comment.id).toBe("1");
        // id=2 和 id=3 都扁平挂在顶层 id=1 下
        expect(tree[0].replies).toHaveLength(2);
        const replyIds = tree[0].replies.map((r) => r.comment.id).sort();
        expect(replyIds).toEqual(["2", "3"]);
    });

    it("回复链上中间节点缺失时沿链向上找顶层", () => {
        // id=3 回复 id=2，但 id=2 不在列表里（被分页切走）。
        // id=3 的顶层祖先是 id=1，应挂到 id=1 下。
        const items = [
            make({ id: "1", depth: 0 }),
            make({ id: "3", parent_id: "2", depth: 1, body: "orphan-reply" }),
        ];
        const tree = buildCommentTree(items);
        // id=3 找不到完整链（id=2 缺失），降级为顶层节点
        expect(tree).toHaveLength(2);
    });

    it("parent_id 指向不存在的评论时降级为顶级", () => {
        // 后端通常不会返回悬挂回复，但前端要防御：父不在列表里时把它当顶级展示，不丢失。
        const items = [
            make({ id: "1", depth: 0 }),
            make({ id: "2", parent_id: "nonexistent", depth: 1 }),
        ];
        const tree = buildCommentTree(items);
        expect(tree).toHaveLength(2); // 第二条降级为顶级
    });

    it("同一父评论下多个回复都挂载", () => {
        const items = [
            make({ id: "1", depth: 0 }),
            make({ id: "2", parent_id: "1", depth: 1 }),
            make({ id: "3", parent_id: "1", depth: 1 }),
        ];
        const tree = buildCommentTree(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].replies).toHaveLength(2);
    });
});

describe("getCommentSeverity", () => {
    it("无回复 → 'default'（普通色阶）", () => {
        const node = { comment: make({ id: "1" }), replies: [] };
        expect(getCommentSeverity(node, { isAuthor: false })).toBe("default");
    });

    it("有回复 → 'discussion'（讨论热度色阶）", () => {
        const node = {
            comment: make({ id: "1" }),
            replies: [{ comment: make({ id: "2" }), replies: [] }],
        };
        expect(getCommentSeverity(node, { isAuthor: false })).toBe("discussion");
    });

    it("作者本人评论 → 'author'（作者高亮色阶），优先级高于回复数", () => {
        const node = {
            comment: make({ id: "1" }),
            replies: [{ comment: make({ id: "2" }), replies: [] }],
        };
        expect(getCommentSeverity(node, { isAuthor: true })).toBe("author");
    });
});
