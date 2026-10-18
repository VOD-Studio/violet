import { type ReactNode, useId } from "react";
import { formatMessage } from "../locale.ts";
import { CountBadge } from "./count-badge.tsx";
import type { BoardMessages } from "./messages.ts";
import { QuickAdd, type QuickAddProps } from "./quick-add.tsx";

export interface ColumnViewProps {
	id: string;
	title: string;
	/** 列内卡片总数。 */
	count: number;
	/** 筛选生效时匹配的卡片数；没有筛选为 null。 */
	matched: number | null;
	/** 使用方的列头渲染，取代默认的标题与计数；返回 `null` 就不显示列头。 */
	renderHeader?: () => ReactNode;
	/** 显示折叠按钮。 */
	collapsible: boolean;
	collapsed: boolean;
	onToggle(): void;
	/** 列底快速添加；不提供则不显示。 */
	quickAdd?: Pick<QuickAddProps, "onSubmit" | "onError" | "onOpen">;
	/**
	 * 列切换布局里这一列是切换器的面板：标题与计数由对应的标签显示，列头不再重复，
	 * 面板以标签为名称。
	 */
	panel?: { id: string; labelledBy: string };
	messages: BoardMessages;
	/** 卡片列表或空状态。 */
	children: ReactNode;
}

/**
 * 一列：列头（标题、计数、折叠按钮）、可折叠的列体与列底快速添加。
 *
 * 列体里的聚焦环会外扩，折叠动画又必须裁剪溢出，所以裁剪层四周留出内边距并以负外边距抵消。
 */
export function ColumnView({
	id,
	title,
	count,
	matched,
	renderHeader,
	collapsible,
	collapsed,
	onToggle,
	quickAdd,
	panel,
	messages,
	children,
}: ColumnViewProps) {
	const bodyId = useId();
	const heading = renderHeader ? (
		renderHeader()
	) : panel ? null : (
		<header className="v-kanban__column-header">
			<h3 className="v-kanban__column-title">{title}</h3>
			<CountBadge count={count} matched={matched} messages={messages} />
		</header>
	);
	return (
		<div
			{...(panel
				? { role: "tabpanel", id: panel.id, "aria-labelledby": panel.labelledBy }
				: { role: "group", "aria-label": title })}
			className="v-kanban__column"
			data-column-id={id}
			data-collapsed={collapsed ? "true" : undefined}
		>
			{collapsible ? (
				<div className="v-kanban__column-top">
					{heading}
					<button
						type="button"
						className="v-kanban__collapse"
						aria-expanded={!collapsed}
						aria-controls={bodyId}
						aria-label={formatMessage(
							collapsed ? messages.expandColumn : messages.collapseColumn,
							{ column: title },
						)}
						onClick={onToggle}
					>
						<svg
							viewBox="0 0 16 16"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d={collapsed ? "M6 3.5 10.5 8 6 12.5" : "M3.5 6 8 10.5 12.5 6"} />
						</svg>
					</button>
				</div>
			) : (
				heading
			)}
			<div id={bodyId} className="v-kanban__column-body">
				<div className="v-kanban__column-body-inner" inert={collapsed}>
					{children}
					{quickAdd ? (
						<QuickAdd
							columnTitle={title}
							messages={messages}
							onSubmit={quickAdd.onSubmit}
							onError={quickAdd.onError}
							onOpen={quickAdd.onOpen}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}
