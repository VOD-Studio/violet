/**
 * ReactionBar 组件测试
 *
 * 验证：
 * - 按聚合后的反应展示计数
 * - 当前用户已反应的表情高亮
 * - 未登录态只读
 * - 点击已反应表情调用 remove，未反应调用 add
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@features/auth/api/queries", () => ({
    useMe: (opts: { enabled?: boolean }) => ({
        data: opts.enabled === false ? null : { id: "user-1", username: "u1" },
    }),
}));

const addMutate = vi.fn();
const removeMutate = vi.fn();
vi.mock("@features/comments/api/mutations", () => ({
    useAddReaction: () => ({ mutate: addMutate, isPending: false }),
    useRemoveReaction: () => ({ mutate: removeMutate, isPending: false }),
}));

import type { Reaction } from "../../model/types";

const reactionsFromContext = vi.fn((_commentId: string) => ({
    reactions: [] as Reaction[],
    isLoading: false,
}));
vi.mock("../ReactionProvider", () => ({
    useReactionsFromContext: (commentId: string) => reactionsFromContext(commentId),
}));

vi.mock("@features/emojis/ui/EmojiPicker", () => ({
    EmojiPicker: ({
        onSelect,
        selectedIds,
    }: {
        onSelect: (emoji: { id: number }) => void;
        selectedIds?: Set<number>;
    }) => (
        <button
            type="button"
            data-testid="emoji-picker"
            data-selected={selectedIds?.size ?? 0}
            onClick={() => onSelect({ id: 3 })}
        >
            picker
        </button>
    ),
}));

import { ReactionBar } from "../ReactionBar";

describe("ReactionBar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reactionsFromContext.mockReturnValue({ reactions: [], isLoading: false });
    });
    afterEach(() => {
        cleanup();
    });

    it("渲染聚合后的表情及计数", () => {
        reactionsFromContext.mockReturnValue({
            reactions: [
                { emoji_id: 1, emoji_name: "赞", emoji_url: "/1.png", count: 2, self: false },
                { emoji_id: 2, emoji_name: "笑", emoji_url: "/2.png", count: 1, self: false },
            ],
            isLoading: false,
        });
        render(<ReactionBar commentId="c1" isLoggedIn />);

        expect(screen.getByText("2")).toBeTruthy();
        expect(screen.getByText("1")).toBeTruthy();
    });

    it("登录用户已反应的表情高亮并点击可取消", () => {
        reactionsFromContext.mockReturnValue({
            reactions: [
                { emoji_id: 1, emoji_name: "赞", emoji_url: "/1.png", count: 5, self: true },
                { emoji_id: 2, emoji_name: "笑", emoji_url: "/2.png", count: 1, self: false },
            ],
            isLoading: false,
        });
        render(<ReactionBar commentId="c1" isLoggedIn />);

        const chips = document.querySelectorAll('[aria-pressed="true"]');
        expect(chips.length).toBe(1);

        fireEvent.click(chips[0] as Element);
        expect(removeMutate).toHaveBeenCalledWith(1);
    });

    it("点击未反应表情调用 add", () => {
        reactionsFromContext.mockReturnValue({
            reactions: [
                { emoji_id: 1, emoji_name: "赞", emoji_url: "/1.png", count: 3, self: false },
            ],
            isLoading: false,
        });
        render(<ReactionBar commentId="c1" isLoggedIn />);

        const chip = document.querySelector('[aria-pressed="false"]') as Element;
        fireEvent.click(chip);
        expect(addMutate).toHaveBeenCalledWith({ emoji_id: 1 });
    });

    it("已反应表情从选择器再次选择不会重复 add", () => {
        reactionsFromContext.mockReturnValue({
            reactions: [
                { emoji_id: 3, emoji_name: "爱心", emoji_url: "/3.png", count: 1, self: true },
            ],
            isLoading: false,
        });
        render(<ReactionBar commentId="c1" isLoggedIn />);

        fireEvent.click(screen.getByTestId("emoji-picker"));
        expect(addMutate).not.toHaveBeenCalled();
    });

    it("反应计数超过 99 显示 99+", () => {
        reactionsFromContext.mockReturnValue({
            reactions: [
                { emoji_id: 1, emoji_name: "赞", emoji_url: "/1.png", count: 150, self: false },
            ],
            isLoading: false,
        });
        render(<ReactionBar commentId="c1" isLoggedIn />);
        expect(screen.getByText("99+")).toBeTruthy();
    });

    it("未登录态不渲染添加表情按钮", () => {
        render(<ReactionBar commentId="c1" isLoggedIn={false} />);
        expect(screen.queryByTestId("emoji-picker")).toBeNull();
    });

    it("后端返回 null 时按空数组渲染不报错", () => {
        reactionsFromContext.mockReturnValue({
            reactions: null as unknown as Reaction[],
            isLoading: false,
        });
        const { container } = render(<ReactionBar commentId="c1" isLoggedIn />);
        expect(container.querySelectorAll("[aria-pressed]").length).toBe(0);
    });
});
