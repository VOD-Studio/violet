import type { Emoji } from "@features/emojis/model/types";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";

/** 表情编辑表单状态，textContent 对应后端 text_content */
export interface EmojiEditForm {
    name: string;
    url: string;
    textContent: string;
}

interface EmojiEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    emoji: Emoji | null;
    form: EmojiEditForm;
    onFormChange: (form: EmojiEditForm) => void;
    onSave: () => void;
    isSaving: boolean;
}

/**
 * EmojiEditDialog - 编辑表情弹窗
 *
 * 图片表情编辑名称与图片链接，文本表情编辑名称与文本内容。
 * 表单状态由父组件持有，保存时映射 textContent 到 text_content。
 */
export function EmojiEditDialog({
    open,
    onOpenChange,
    emoji,
    form,
    onFormChange,
    onSave,
    isSaving,
}: EmojiEditDialogProps) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="编辑表情"
            description="修改表情的名称和内容"
            size="md"
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={onSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        保存
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {emoji && (
                    <div className="flex justify-center">
                        <div className="flex size-24 items-center justify-center rounded-lg border bg-muted/50">
                            {emoji.url ? (
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
                    <label htmlFor="emoji-edit-name" className="text-sm font-medium">
                        名称
                    </label>
                    <Input
                        id="emoji-edit-name"
                        value={form.name}
                        onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                        placeholder="表情名称"
                    />
                </div>

                {emoji?.url ? (
                    <div className="space-y-2">
                        <label htmlFor="emoji-edit-url" className="text-sm font-medium">
                            图片链接
                        </label>
                        <Input
                            id="emoji-edit-url"
                            value={form.url}
                            onChange={(e) => onFormChange({ ...form, url: e.target.value })}
                            placeholder="URL"
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label htmlFor="emoji-edit-text" className="text-sm font-medium">
                            文本内容
                        </label>
                        <Input
                            id="emoji-edit-text"
                            value={form.textContent}
                            onChange={(e) => onFormChange({ ...form, textContent: e.target.value })}
                            placeholder="文本内容"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}
