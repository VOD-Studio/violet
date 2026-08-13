import { type ReactNode, useEffect, useRef, useState } from "react";

interface PageShellProps {
	/** 页面主标题（h1，唯一来源，由 shell 渲染） - 注意：TopBar 已显示标题，此处不再渲染 */
	title: string;
	/** 副标题描述 */
	description?: string;
	/** 标题区右侧操作（如「创建分组」按钮） */
	action?: ReactNode;
	/** 固定在标题区下方的额外内容（如表格工具栏、筛选器），随标题区一起 sticky */
	sticky?: ReactNode;
	/** 页面主体内容 */
	children: ReactNode;
}

/**
 * PageShell - 后台页面内容壳
 *
 * 统一后台页面的副标题、操作区与内容区间距。
 * 注意：页面主标题 (h1) 已由 TopBar 渲染，此组件不再重复显示。
 *
 * 标题区始终保持固定高度（min-h-9 = 按钮 size-sm 的高度），
 * 即使某页面没有 action 按钮（如只读页），切换页面时也不会因高度变化而抖动。
 *
 * 标题区用 shrink-0 固定在内容区滚动容器上方，不随滚动消失；
 * 内容超出视口时由内容区滚动容器接管滚动，滚动条贴 main 视口边缘（无水平 padding）。
 * flex-1 让内容少时撑满高度（表格页 DataTable max-h-full 据此限高并内部滚动），
 * 内容多时由 flex 子项默认 min-height:auto 撑开触发外层滚动（非表格页如 settings 长表单）。
 */
export function PageShell({ description, action, sticky, children }: PageShellProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const sEl = scrollRef.current;
		if (!sEl) return;
		const handleScroll = () => setScrolled(sEl.scrollTop > 8);
		handleScroll();
		sEl.addEventListener("scroll", handleScroll);
		return () => sEl.removeEventListener("scroll", handleScroll);
	}, []);

	// 既无描述也无操作且无 sticky 内容时,直接渲染内容(无标题区,不占额外空间)
	// 内边距与正常路径内容区一致(px-4 md:px-6):自内边距职责从 <main> 移入
	// PageShell 后,此分支是页面唯一的内边距来源,缺失会导致内容紧贴边缘。
	// 注意:early return 必须在所有 hooks 之后,否则违反 React Hooks 规则。
	if (!description && !action && !sticky) {
		return (
			<div className="h-full overflow-y-auto">
				<div className="flex min-h-full flex-col px-4 pt-4 pb-6 md:px-6">{children}</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/*
			 * relative z-10 shrink-0：标题区固定在滚动容器上方，不随内容滚动消失。
			 * relative 让 z-10 生效（static 下 z-index 无效），使滚动时投向内容区的
			 * shadow 不被后绘制的滚动容器盖住。bg-background 100% 不透明。
			 * 滚动时加 border-b + shadow 强化标题区与内容的分区。
			 */}
			<div
				className={`relative z-10 shrink-0 bg-background px-4 md:px-6 pt-4 pb-4 ${scrolled ? "border-b border-edge-hairline shadow-lg" : ""}`}
			>
				{/* 副标题和操作区：min-h-9 保证有无 action 时行高一致(36px),
					避免切换页面时标题区高度跳动(有 action 36px / 无 action 32px) */}
				{(description || action) && (
					<div className="flex min-h-9 flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
						{description && (
							<p className="text-muted-foreground text-sm">{description}</p>
						)}
						<div className="flex h-8 items-center gap-2 empty:hidden">{action}</div>
					</div>
				)}
				{/* sticky 额外内容：表格工具栏、筛选器等 */}
				{sticky}
			</div>
			{/* 内容区滚动容器：overflow-y-auto 接管非表格页滚动（表格页靠 DataTable
				内部 OverlayScroll 滚动，此处不触发）。无水平 padding，滚动条贴 main 边缘。
				isolate 困住 DataTable 固定列 z-index，防止越界到标题区之上。 */}
			<div
				ref={scrollRef}
				className="relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto"
			>
				<div className="flex flex-1 flex-col gap-6 px-4 pb-6 md:px-6">{children}</div>
			</div>
		</div>
	);
}
