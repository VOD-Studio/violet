/**
 * EmojiEditDialog 组件测试
 *
 * 验证 meta 子字段（alias/size/type）被正确映射到 UpdateEmojiRequest.meta：
 * - 填写别名时，meta 下发对应字段
 * - 全部留空（未设置）时，meta 下发空对象以清空后端 meta
 */
import type { Emoji } from "@entities/emoji/model/types";
import type { UpdateEmojiRequest } from "@features/admin-emojis/model/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmojiEditDialog } from "../EmojiEditDialog";

const imageEmoji: Emoji = {
    id: 10,
    name: "[保佑]",
    url: "/emoji.png",
    meta: { alias: "保佑", size: 1, type: 1 },
};

describe("EmojiEditDialog meta 映射", () => {
    afterEach(() => {
        cleanup();
    });

    it("回显已有 meta 并在提交时下发", async () => {
        const onSave = vi.fn();
        render(
            <EmojiEditDialog
                open
                onOpenChange={() => {}}
                emoji={imageEmoji}
                onSave={onSave}
                isSaving={false}
            />,
        );

        // 别名已回显
        const aliasInput = screen.getByLabelText("别名") as HTMLInputElement;
        expect(aliasInput.value).toBe("保佑");

        fireEvent.submit(document.getElementById("emoji-edit-form") as HTMLFormElement);

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const body = onSave.mock.calls[0][0] as UpdateEmojiRequest;
        expect(body.meta).toEqual({ alias: "保佑", size: 1, type: 1 });
    });

    it("修改别名时保留下发的 size/type", async () => {
        const onSave = vi.fn();
        render(
            <EmojiEditDialog
                open
                onOpenChange={() => {}}
                emoji={imageEmoji}
                onSave={onSave}
                isSaving={false}
            />,
        );

        fireEvent.change(screen.getByLabelText("别名"), { target: { value: "祈愿" } });
        fireEvent.submit(document.getElementById("emoji-edit-form") as HTMLFormElement);

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const body = onSave.mock.calls[0][0] as UpdateEmojiRequest;
        // alias 改为新值，size/type 保留原值
        expect(body.meta).toEqual({ alias: "祈愿", size: 1, type: 1 });
    });

    it("无 meta 的表情提交时下发空对象", async () => {
        const onSave = vi.fn();
        const noMetaEmoji: Emoji = { id: 11, name: "[doge]", url: "/doge.png" };
        render(
            <EmojiEditDialog
                open
                onOpenChange={() => {}}
                emoji={noMetaEmoji}
                onSave={onSave}
                isSaving={false}
            />,
        );

        fireEvent.submit(document.getElementById("emoji-edit-form") as HTMLFormElement);

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const body = onSave.mock.calls[0][0] as UpdateEmojiRequest;
        // 三字段全空 → hasMeta 为 false → 下发空对象清空 meta
        expect(body.meta).toEqual({});
    });
});
