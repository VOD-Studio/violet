import type { Emoji } from "@features/emojis/model/types";
import { Button } from "@shared/ui/button";
import { Check, Edit, Link, Trash2, Type } from "lucide-react";
import type { ReactNode } from "react";

interface EmojiCardProps {
	emoji: Emoji;
	isSelectMode: boolean;
	isSelected: boolean;
	onToggleSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

/**
 * EmojiCard - 单个表情卡片
 *
 * 图片表情用 img 渲染，纯文字用文字块兜底。
 * 批量模式用 button 容器，点击或键盘激活切换选中；普通模式为静态展示，hover 显示编辑与删除。
 */
export function EmojiCard({
	emoji,
	isSelectMode,
	isSelected,
	onToggleSelect,
	onEdit,
	onDelete,
}: EmojiCardProps) {
	const baseClass = `group relative rounded-lg border p-1 transition-all duration-200 ${
		isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50 hover:shadow-sm"
	} ${isSelectMode ? "cursor-pointer" : ""}`;

	const body: ReactNode = (
		<>
			{isSelectMode && (
				<div className="absolute left-1 top-1 z-10">
					<div
						className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
							isSelected
								? "border-primary bg-primary"
								: "border-muted-foreground/30 bg-background/80"
						}`}
					>
						{isSelected && <Check className="size-3 text-primary-foreground" />}
					</div>
				</div>
			)}

			{emoji.url ? (
				<img
					src={emoji.url}
					alt={emoji.name}
					className="aspect-square w-full rounded object-cover"
				/>
			) : (
				<div
					className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xl"
					title={emoji.name}
				>
					{emoji.text_content ?? emoji.name}
				</div>
			)}

			{!isSelectMode && (
				<>
					<div className="absolute right-1 top-1 hidden gap-1 transition-opacity group-hover:flex">
						<Button
							variant="ghost"
							size="icon-xs"
							className="bg-background/90 backdrop-blur-sm"
							onClick={(e) => {
								e.stopPropagation();
								onEdit();
							}}
						>
							<Edit className="size-3" />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							className="bg-background/90 text-destructive backdrop-blur-sm hover:text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onDelete();
							}}
						>
							<Trash2 className="size-3" />
						</Button>
					</div>

					<div className="absolute bottom-1 left-1 right-1 hidden transition-opacity group-hover:block">
						<div className="flex items-center gap-0.5 rounded bg-background/90 px-1.5 py-0.5 text-xs backdrop-blur-sm">
							{emoji.url ? (
								<Link className="size-3 shrink-0" />
							) : (
								<Type className="size-3 shrink-0" />
							)}
							<span className="truncate">{emoji.name}</span>
						</div>
					</div>
				</>
			)}
		</>
	);

	if (isSelectMode) {
		return (
			<button
				type="button"
				className={`${baseClass} w-full appearance-none bg-transparent text-left`}
				onClick={onToggleSelect}
			>
				{body}
			</button>
		);
	}

	return <div className={baseClass}>{body}</div>;
}
