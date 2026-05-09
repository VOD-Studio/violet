import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  CheckSquare,
  Square,
  Trash2,
  Check,
  X,
} from "lucide-react";

/** EmojiToolbar 组件的属性 */
interface EmojiToolbarProps {
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变化回调 */
  onSearchChange: (value: string) => void;
  /** 是否为批量选择模式 */
  isSelectMode: boolean;
  /** 切换批量选择模式回调 */
  onToggleSelectMode: () => void;
  /** 已选中的数量 */
  selectedCount: number;
  /** 批量删除回调 */
  onBatchDelete: () => void;
  /** 是否显示添加文本表单 */
  showAddText: boolean;
  /** 切换添加文本表单回调 */
  onToggleAddText: () => void;
  /** 文本表单数据 */
  textForm: { name: string; textContent: string };
  /** 文本表单数据变化回调 */
  onTextFormChange: (form: { name: string; textContent: string }) => void;
  /** 添加文本表情回调 */
  onAddTextEmoji: () => void;
}

export function EmojiToolbar({
  searchQuery,
  onSearchChange,
  isSelectMode,
  onToggleSelectMode,
  selectedCount,
  onBatchDelete,
  showAddText,
  onToggleAddText,
  textForm,
  onTextFormChange,
  onAddTextEmoji,
}: EmojiToolbarProps) {
  return (
    <>
      <div className="flex items-center gap-2 shrink-0 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索表情名称..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
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
        <div className="flex gap-2 p-3 rounded-lg border bg-muted/50 shrink-0 mb-4">
          <Input
            placeholder="名称"
            value={textForm.name}
            onChange={(e) =>
              onTextFormChange({ ...textForm, name: e.target.value })
            }
            className="w-32"
          />
          <Input
            placeholder="文本内容（如：(・∀・)）"
            value={textForm.textContent}
            onChange={(e) =>
              onTextFormChange({ ...textForm, textContent: e.target.value })
            }
            className="flex-1"
          />
          <Button size="sm" onClick={onAddTextEmoji}>
            <Check className="mr-1 size-4" />
            添加
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleAddText}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    </>
  );
}
