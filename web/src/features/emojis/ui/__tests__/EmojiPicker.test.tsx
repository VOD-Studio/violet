/**
 * EmojiPicker 组件测试
 *
 * 验证：
 * - 加载态显示加载中
 * - 按分组标签展示表情
 * - 点击表情触发 onSelect 并关闭浮层
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groups = [
    {
        id: 1,
        name: "默认",
        source: "system",
        sort_order: 0,
        is_enabled: true,
        emojis: [
            { id: 1, name: "赞", url: "/1.png" },
            { id: 2, name: "笑", url: "/2.png", text_content: "😄" },
        ],
    },
];

const useAllEmojis = vi.fn();
vi.mock("@features/emojis/api/queries", () => ({
    useAllEmojis: () => useAllEmojis(),
}));

import { EmojiPicker } from "../EmojiPicker";

describe("EmojiPicker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        cleanup();
    });

    it("加载态显示加载中", () => {
        useAllEmojis.mockReturnValue({ data: undefined, isLoading: true });
        render(<EmojiPicker onSelect={vi.fn()} />);
        fireEvent.click(screen.getByLabelText("添加表情"));
        expect(screen.getByText("加载中…")).toBeTruthy();
    });

    it("展示分组与表情，点击触发 onSelect", () => {
        const onSelect = vi.fn();
        useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
        render(<EmojiPicker onSelect={onSelect} />);

        fireEvent.click(screen.getByLabelText("添加表情"));

        expect(screen.getByText("默认")).toBeTruthy();
        const buttons = document.querySelectorAll("button[title]");
        const zan = Array.from(buttons).find((b) => b.getAttribute("title") === "赞");
        expect(zan).toBeTruthy();

        fireEvent.click(zan as Element);
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "赞" }));
    });

    it("已选中的表情禁用且不可点击", () => {
        const onSelect = vi.fn();
        useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
        render(<EmojiPicker onSelect={onSelect} selectedIds={new Set([1])} />);

        fireEvent.click(screen.getByLabelText("添加表情"));

        const buttons = document.querySelectorAll("button[title]");
        const zan = Array.from(buttons).find((b) => b.getAttribute("title")?.startsWith("赞"));
        expect(zan).toBeTruthy();
        expect((zan as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(zan as Element);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
