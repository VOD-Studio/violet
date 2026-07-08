/**
 * ReactionProvider 测试
 *
 * 验证：
 * - 批量查询返回的 reactions 为 null 时，useReactionsFromContext 返回空数组
 * - 批量查询正常返回时，子组件能读到对应评论的反应
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchReactionResult, Reaction } from "../../model/types";
import { ReactionProvider, useReactionsFromContext } from "../ReactionProvider";

const batchReactions = vi.fn((_ids: string[]) => ({
    data: undefined as BatchReactionResult[] | undefined,
    isLoading: false,
}));
const singleReactions = vi.fn((_id: string, _options: { enabled?: boolean }) => ({
    data: undefined as Reaction[] | undefined,
    isLoading: false,
}));

vi.mock("../../api/queries", () => ({
    useBatchReactions: (ids: string[]) => batchReactions(ids),
    useCommentReactions: (_id: string, options: { enabled?: boolean }) =>
        singleReactions(_id, options),
}));

function Reader({ commentId }: { commentId: string }) {
    const { reactions, isLoading } = useReactionsFromContext(commentId);
    return (
        <div>
            <span data-testid="loading">{isLoading ? "loading" : "done"}</span>
            <span data-testid="count">{reactions.length}</span>
            {reactions.map((r) => (
                <span key={r.emoji_id} data-testid={`emoji-${r.emoji_id}`}>
                    {r.emoji_name}
                </span>
            ))}
        </div>
    );
}

describe("ReactionProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        batchReactions.mockReturnValue({ data: undefined, isLoading: false });
        singleReactions.mockReturnValue({ data: undefined, isLoading: false });
    });
    afterEach(() => {
        cleanup();
    });

    it("批量返回 null reactions 时按空数组处理，不报 is not iterable", () => {
        batchReactions.mockReturnValue({
            data: [{ comment_id: "c1", reactions: null as unknown as Reaction[] }],
            isLoading: false,
        });

        render(
            <ReactionProvider commentIds={["c1"]}>
                <Reader commentId="c1" />
            </ReactionProvider>,
        );

        expect(screen.getByTestId("count").textContent).toBe("0");
        expect(screen.getByTestId("loading").textContent).toBe("done");
    });

    it("批量查询返回正常反应数据", () => {
        batchReactions.mockReturnValue({
            data: [
                {
                    comment_id: "c1",
                    reactions: [
                        {
                            emoji_id: 1,
                            emoji_name: "赞",
                            emoji_url: "/1.png",
                            count: 3,
                            self: true,
                        },
                    ] as Reaction[],
                },
            ],
            isLoading: false,
        });

        render(
            <ReactionProvider commentIds={["c1"]}>
                <Reader commentId="c1" />
            </ReactionProvider>,
        );

        expect(screen.getByTestId("count").textContent).toBe("1");
        expect(screen.getByTestId("emoji-1").textContent).toBe("赞");
    });
});
