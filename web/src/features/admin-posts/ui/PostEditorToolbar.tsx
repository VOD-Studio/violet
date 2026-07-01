import { Button } from "@shared/ui/button";
import { X } from "lucide-react";

interface PostEditorToolbarProps {
    /** 编辑模式用于显示标题 */
    isEdit: boolean;
    /** 提交进行中，禁用按钮 */
    saving: boolean;
    onBack: () => void;
    onSaveDraft: () => void;
    onPublish: () => void;
}

/** PostEditorToolbar - 编辑器顶栏，返回按钮 + 标题 + 保存/发布 */
export function PostEditorToolbar({
    isEdit,
    saving,
    onBack,
    onSaveDraft,
    onPublish,
}: PostEditorToolbarProps) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon-sm" onClick={onBack} title="返回列表">
                    <X />
                </Button>
                <h1 className="text-lg font-semibold">{isEdit ? "编辑文章" : "新建文章"}</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
                    保存草稿
                </Button>
                <Button onClick={onPublish} disabled={saving}>
                    发布
                </Button>
            </div>
        </div>
    );
}
