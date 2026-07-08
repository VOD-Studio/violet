import { type EmojiTextForm, emojiTextSchema } from "@features/admin-emojis/model/schema";
import type { CreateEmojiRequest } from "@features/admin-emojis/model/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Check, CheckSquare, Plus, Square, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { SearchInput } from "@/shared/ui/search-input";

interface EmojiToolbarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    isSelectMode: boolean;
    onToggleSelectMode: () => void;
    selectedCount: number;
    onBatchDelete: () => void;
    showAddText: boolean;
    onToggleAddText: () => void;
    onAddTextEmoji: (body: CreateEmojiRequest) => void;
    isAddingText?: boolean;
}

/**
 * EmojiToolbar - 表情管理工具栏
 *
 * 搜索框、批量选择切换、批量删除、添加文本表情表单。
 * 文本表情表单由本组件通过 react-hook-form 管理，提交后清空。
 */
export function EmojiToolbar({
    searchQuery,
    onSearchChange,
    isSelectMode,
    onToggleSelectMode,
    selectedCount,
    onBatchDelete,
    showAddText,
    onToggleAddText,
    onAddTextEmoji,
    isAddingText = false,
}: EmojiToolbarProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<EmojiTextForm>({
        resolver: zodResolver(emojiTextSchema),
        defaultValues: { name: "", textContent: "" },
    });

    useEffect(() => {
        if (!showAddText) {
            reset({ name: "", textContent: "" });
        }
    }, [showAddText, reset]);

    const onSubmit = (data: EmojiTextForm) => {
        onAddTextEmoji({
            name: data.name.trim(),
            text_content: data.textContent.trim(),
        });
    };

    return (
        <>
            <div className="mb-4 flex shrink-0 items-center gap-2 px-1 pt-1">
                <div className="flex-1">
                    <SearchInput
                        placeholder="搜索表情名称..."
                        defaultValue={searchQuery}
                        onSearch={onSearchChange}
                    />
                </div>

                <Button
                    variant={isSelectMode ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleSelectMode}
                >
                    {isSelectMode ? (
                        <>
                            <CheckSquare className="mr-1 size-4" />
                            取消选择
                        </>
                    ) : (
                        <>
                            <Square className="mr-1 size-4" />
                            批量选择
                        </>
                    )}
                </Button>

                {isSelectMode && selectedCount > 0 && (
                    <Button variant="destructive" size="sm" onClick={onBatchDelete}>
                        <Trash2 className="mr-1 size-4" />
                        删除 ({selectedCount})
                    </Button>
                )}

                <Button variant="outline" size="sm" onClick={onToggleAddText}>
                    <Plus className="mr-1 size-4" />
                    文本表情
                </Button>
            </div>

            {showAddText && (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mb-4 flex shrink-0 items-center gap-2 rounded-lg border bg-muted/50 p-3"
                >
                    <Input
                        placeholder="名称"
                        disabled={isAddingText}
                        aria-invalid={!!errors.name}
                        className="h-9 w-32"
                        {...register("name")}
                    />
                    <Input
                        placeholder="文本内容，如 (・∀・)"
                        disabled={isAddingText}
                        aria-invalid={!!errors.textContent}
                        className="h-9 flex-1"
                        {...register("textContent")}
                    />
                    <Button className="h-9 shrink-0" type="submit" disabled={isAddingText}>
                        <Check className="mr-1 size-4" />
                        添加
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-9 shrink-0"
                        onClick={onToggleAddText}
                    >
                        <X className="size-4" />
                    </Button>
                </form>
            )}
        </>
    );
}
