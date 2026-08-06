import { Button } from "@shared/ui/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import {
	History,
	Maximize2,
	Minimize2,
	PanelRight,
	RotateCcw,
	SlidersHorizontal,
	X,
} from "lucide-react";

interface PostEditorToolbarProps {
	/** 编辑模式用于显示标题 */
	isEdit: boolean;
	/** 提交进行中，禁用按钮 */
	saving: boolean;
	/** 额外禁用状态，如加载骨架屏时 */
	disabled?: boolean;
	onBack: () => void;
	onSaveDraft: () => void;
	onPublish: () => void;
	onOpenVersions?: () => void;
	/** 清空（新建模式）/ 重置（编辑模式）当前编辑内容 */
	onReset?: () => void;
	/** 切换 Zen 专注模式 */
	onToggleZen?: () => void;
	/** 当前是否在 Zen 专注模式 */
	zenMode?: boolean;
	/** 右侧栏是否收起 */
	sidebarCollapsed?: boolean;
	/** 切换右侧栏收起/展开 */
	onToggleSidebar?: () => void;
	/** 打开文章设置（移动端侧滑抽屉） */
	onOpenSettings?: () => void;
}

/** PostEditorToolbar - 编辑器顶栏，返回按钮 + 标题 + 重置/保存/发布/专注 */
export function PostEditorToolbar({
	isEdit,
	saving,
	disabled = false,
	onBack,
	onSaveDraft,
	onPublish,
	onOpenVersions,
	onReset,
	onToggleZen,
	zenMode = false,
	sidebarCollapsed = false,
	onToggleSidebar,
	onOpenSettings,
}: PostEditorToolbarProps) {
	const isDisabled = saving || disabled;

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
				{zenMode ? (
					onToggleZen && (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={onToggleZen}
							title="退出专注（Esc）"
						>
							<Minimize2 />
						</Button>
					)
				) : (
					<Button variant="ghost" size="icon-sm" onClick={onBack} title="返回列表">
						<X />
					</Button>
				)}
				<h1 className="text-lg font-semibold">
					{zenMode ? "专注写作" : isEdit ? "编辑文章" : "新建文章"}
				</h1>
			</div>
			<div className="flex flex-wrap items-center justify-end gap-2">
				{/* 设置/专注/重置/历史版本：桌面展开，移动端收进「更多」菜单 */}
				{onOpenSettings && (
					<Button
						variant="outline"
						className="hidden lg:flex"
						onClick={onOpenSettings}
						title="编辑文章设置"
					>
						设置
					</Button>
				)}
				{onToggleSidebar && zenMode && (
					<Button
						variant="ghost"
						size="icon-sm"
						className="hidden lg:flex"
						onClick={onToggleSidebar}
						title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
					>
						<PanelRight className={sidebarCollapsed ? "size-4 opacity-50" : "size-4"} />
					</Button>
				)}
				{/* 专注/重置/历史版本：桌面展开，移动端收进「更多」菜单 */}
				{onToggleZen && !zenMode && (
					<Button
						variant="ghost"
						className="hidden lg:flex"
						onClick={onToggleZen}
						disabled={isDisabled}
						title="进入专注模式"
					>
						<Maximize2 className="size-4" />
						专注
					</Button>
				)}
				{onReset && (
					<Button
						variant="ghost"
						className="hidden lg:flex"
						onClick={onReset}
						disabled={isDisabled}
						title={isEdit ? "放弃改动，恢复到原始数据" : "清空所有内容并删除草稿"}
					>
						<RotateCcw className="size-4" />
						{isEdit ? "重置" : "清空"}
					</Button>
				)}
				{isEdit && (
					<Button
						variant="outline"
						className="hidden lg:flex"
						onClick={onOpenVersions}
						disabled={isDisabled}
					>
						<History className="size-4" /> 历史版本
					</Button>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="lg:hidden" title="更多操作">
							更多
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{onOpenSettings && (
							<>
								<DropdownMenuItem onClick={onOpenSettings} disabled={isDisabled}>
									<SlidersHorizontal className="size-4" /> 文章设置
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						)}
						{onToggleZen && !zenMode && (
							<DropdownMenuItem onClick={onToggleZen} disabled={isDisabled}>
								<Maximize2 className="size-4" /> 进入专注
							</DropdownMenuItem>
						)}
						{onReset && (
							<DropdownMenuItem onClick={onReset} disabled={isDisabled}>
								<RotateCcw className="size-4" />
								{isEdit ? "重置" : "清空"}
							</DropdownMenuItem>
						)}
						{isEdit && (
							<DropdownMenuItem onClick={onOpenVersions} disabled={isDisabled}>
								<History className="size-4" /> 历史版本
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				<Button variant="outline" onClick={onSaveDraft} disabled={isDisabled}>
					保存草稿
				</Button>
				<Button onClick={onPublish} disabled={isDisabled}>
					发布
				</Button>
			</div>
		</div>
	);
}
