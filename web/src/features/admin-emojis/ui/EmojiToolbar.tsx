import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Check, CheckSquare, Plus, Search, Square, Trash2, X } from "lucide-react";

export interface EmojiTextForm {
	name: string;
	textContent: string;
}

interface EmojiToolbarProps {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	isSelectMode: boolean;
	onToggleSelectMode: () => void;
	selectedCount: number;
	onBatchDelete: () => void;
	showAddText: boolean;
	onToggleAddText: () => void;
	textForm: EmojiTextForm;
	onTextFormChange: (form: EmojiTextForm) => void;
	onAddTextEmoji: () => void;
}

/**
 * EmojiToolbar - 表情管理工具栏
 *
 * 搜索框、批量选择切换、批量删除、添加文本表情表单。
 * 纯展示组件，所有状态与回调由父组件持有。
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
	textForm,
	onTextFormChange,
	onAddTextEmoji,
}: EmojiToolbarProps) {
	return (
		<>
			<div className="mb-4 flex shrink-0 items-center gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
				<div className="mb-4 flex shrink-0 gap-2 rounded-lg border bg-muted/50 p-3">
					<Input
						placeholder="名称"
						value={textForm.name}
						onChange={(e) => onTextFormChange({ ...textForm, name: e.target.value })}
						className="w-32"
					/>
					<Input
						placeholder="文本内容，如 (・∀・)"
						value={textForm.textContent}
						onChange={(e) => onTextFormChange({ ...textForm, textContent: e.target.value })}
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
