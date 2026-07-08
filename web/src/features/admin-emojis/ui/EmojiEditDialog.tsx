import type { Emoji } from "@entities/emoji/model/types";
import type { UpdateEmojiRequest } from "@features/admin-emojis/model/types";
import { emojiEditSchema, type EmojiEditForm } from "@features/admin-emojis/model/schema";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface EmojiEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    emoji: Emoji | null;
    onSave: (body: UpdateEmojiRequest) => void;
    isSaving: boolean;
}

/**
 * EmojiEditDialog - 编辑表情弹窗
 *
 * 使用 React Hook Form + Zod 进行表单验证。
 * 图片表情编辑名称与图片链接，文本表情编辑名称与文本内容。
 */
export function EmojiEditDialog({
    open,
    onOpenChange,
    emoji,
    onSave,
    isSaving,
}: EmojiEditDialogProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<EmojiEditForm>({
        resolver: zodResolver(emojiEditSchema),
        defaultValues: { name: "", url: "", textContent: "" },
    });

    useEffect(() => {
        if (!open) return;
        if (emoji) {
            reset({
                name: emoji.name,
                url: emoji.url ?? "",
                textContent: emoji.text_content ?? "",
            });
        } else {
            reset({ name: "", url: "", textContent: "" });
        }
    }, [open, emoji, reset]);

    const onSubmit = (data: EmojiEditForm) => {
        const body: UpdateEmojiRequest = {
            name: data.name.trim(),
            url: emoji?.url ? data.url?.trim() || undefined : undefined,
            text_content: !emoji?.url ? data.textContent?.trim() || undefined : undefined,
        };
        onSave(body);
    };

    const isImage = !!emoji?.url;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="编辑表情"
            description="修改表情的名称和内容"
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="emoji-edit-form" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        保存
                    </Button>
                </>
            }
        >
            <form id="emoji-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {emoji && (
                    <div className="flex justify-center">
                        <div className="flex size-24 items-center justify-center rounded-lg border bg-muted/50">
                            {isImage ? (
                                <img
                                    src={emoji.url}
                                    alt={emoji.name}
                                    className="size-full rounded-lg object-contain"
                                />
                            ) : (
                                <span className="text-3xl">{emoji.text_content ?? emoji.name}</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="emoji-edit-name">
                        名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="emoji-edit-name"
                        disabled={isSaving}
                        aria-invalid={!!errors.name}
                        {...register("name")}
                    />
                    {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                </div>

                {isImage ? (
                    <div className="space-y-2">
                        <Label htmlFor="emoji-edit-url">图片链接</Label>
                        <Input
                            id="emoji-edit-url"
                            placeholder="URL"
                            disabled={isSaving}
                            {...register("url")}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="emoji-edit-text">文本内容</Label>
                        <Input
                            id="emoji-edit-text"
                            placeholder="文本内容"
                            disabled={isSaving}
                            {...register("textContent")}
                        />
                    </div>
                )}
            </form>
        </Modal>
    );
}
