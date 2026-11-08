/**
 * EditorToolbar - 富文本编辑器顶部工具栏
 *
 * 固定在编辑区上方，按分组渲染按钮：历史 / 标题 / 文本格式 / 列表与块。
 * 图片按钮单独处理（需触发上传/素材选择，故由父组件注入回调）。
 * 按钮基于编辑器命令的 active 态高亮、disabled 态置灰。
 * 能力裁剪由父级传入 ResolvedFeatures：color/align/underline/imageLibrary
 * 关闭时对应色板、分组、按钮与图片下拉随扩展 schema 同步收窄。
 */
import type { Editor } from "@tiptap/react";
import {
	Button,
	ColorSwatch,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@violet/ui";
import { cn } from "cn";
import { ChevronDown, ImagePlus, Upload } from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo } from "react";

import { useEditorTextColor } from "../hooks/useEditorTextColor";
import type { ResolvedFeatures } from "../lib/features";
import { buildToolbarItems, TOOLBAR_DIVIDER, type ToolbarItem } from "./toolbar-items";

interface EditorToolbarProps {
	editor: Editor | null;
	/** 能力集：color/align/underline/imageLibrary 关闭项对应的 UI 一并隐藏 */
	features?: ResolvedFeatures;
	/** 从素材库选择图片 */
	onPickImage: () => void;
	/** 上传本地图片到编辑器 */
	onUploadImage: () => void;
	/** 链接插入回调（由父组件注入：打开输入弹窗） */
	onInsertLink: () => void;
}

/** 只拦工具栏内按钮；Portal 面板中的输入框必须能正常聚焦。 */
function keepFocus(e: MouseEvent<HTMLElement>) {
	if (
		e.target instanceof Element &&
		e.currentTarget.contains(e.target) &&
		e.target.closest("button")
	) {
		e.preventDefault();
	}
}

export function EditorToolbar({
	editor,
	features,
	onPickImage,
	onUploadImage,
	onInsertLink,
}: EditorToolbarProps) {
	const items = useMemo(
		() => buildToolbarItems(onInsertLink, features),
		[onInsertLink, features],
	);
	const textColor = useEditorTextColor(editor);
	if (!editor) return null;

	const renderItem = (item: ToolbarItem | typeof TOOLBAR_DIVIDER, idx: number) => {
		if (item === TOOLBAR_DIVIDER) {
			return (
				<span
					key={`d-${idx}`}
					className="mx-0.5 h-5 w-px shrink-0 bg-edge-hairline"
					aria-hidden
				/>
			);
		}
		const Icon = item.icon;
		const active = item.isActive(editor);
		const disabled = item.canRun ? !item.canRun(editor) : false;
		return (
			<Button
				key={item.id}
				type="button"
				variant="ghost"
				size="icon-sm"
				title={item.title}
				disabled={disabled}
				onMouseDown={keepFocus}
				onClick={() => item.run(editor)}
				className={cn(active && "bg-accent text-accent-foreground")}
			>
				<Icon />
			</Button>
		);
	};

	return (
		<div
			className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-edge-hairline bg-background/80 px-2 py-1.5 backdrop-blur"
			// React Portal 仍向工具栏冒泡，但不属于工具栏的 DOM 子树。
			onMouseDown={keepFocus}
		>
			{items.map(renderItem)}
			{features?.color !== false && (
				<>
					<span className="mx-0.5 h-5 w-px shrink-0 bg-edge-hairline" aria-hidden />
					{/* 文字颜色色板（color 能力关闭时隐藏） */}
					<ColorSwatch
						{...textColor}
						onChange={(color) => editor.chain().setColor(color).run()}
						onClear={() => editor.chain().unsetColor().run()}
					/>
				</>
			)}
			<span className="mx-0.5 h-5 w-px shrink-0 bg-edge-hairline" aria-hidden />
			{/* 图片插入：imageLibrary 关闭时退化为单按钮本地上传 */}
			{features?.imageLibrary === false ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					title="上传图片"
					onClick={onUploadImage}
				>
					<ImagePlus />
				</Button>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title="插入图片"
							className="w-auto min-w-8 px-1.5"
						>
							<ImagePlus />
							<ChevronDown className="size-3 opacity-50" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onPickImage}>
							<ImagePlus />
							从素材库选择
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onUploadImage}>
							<Upload />
							上传本地图片
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
