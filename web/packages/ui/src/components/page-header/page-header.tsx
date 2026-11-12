import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** 详情页左上角的返回入口；名称写去哪，如「返回文章」。 */
export interface PageHeaderBack {
	href: string;
	label: string;
}

export interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
	/** 页面唯一的 h1；窄条形态复用同一个标题节点 */
	title: string;
	/** 一句事实说明，如数量与状态；省略时不渲染 */
	description?: ReactNode;
	/** 面包屑节点，通常传 `<Breadcrumbs />` */
	breadcrumbs?: ReactNode;
	/** 次要操作，最多两个，再多收进 ⋯ */
	actions?: ReactNode;
	/** 本页唯一的主操作；窄条形态只保留它 */
	primaryAction?: ReactNode;
	/** 平级分区标签页，贴着页头底边 */
	tabs?: ReactNode;
	/** 详情页的返回入口 */
	back?: PageHeaderBack;
	/** 标题后的状态，如「草稿」 */
	status?: ReactNode;
	/** 说明位置的保存时间、字数等结构化信息 */
	meta?: ReactNode;
	/** 由宿主按滚动位置切换：只留 56 高标题与主操作的窄条 */
	compact?: boolean;
	/** 窄条标题后的摘要，如「270 篇」 */
	compactSummary?: ReactNode;
}

/**
 * 页面顶部的位置、标题、说明与操作；往下滚时由宿主切到 56 高的窄条。
 *
 * @remarks
 * 窄条与完整页头共用同一份 DOM，不复制标题和操作，因此读屏只读一次。
 * 完整页头保留唯一 h1；`compact` 只改变呈现，不改变文档结构。
 */
export function PageHeader({
	title,
	description,
	breadcrumbs,
	actions,
	primaryAction,
	tabs,
	back,
	status,
	meta,
	compact = false,
	compactSummary,
	className,
	...props
}: PageHeaderProps) {
	return (
		<header
			data-slot="page-header"
			data-compact={compact ? "" : undefined}
			className={cn("v-page-header", className)}
			{...props}
		>
			{back !== undefined ? (
				<a
					className="v-page-header__back"
					href={back.href}
					aria-label={`返回${back.label}`}
				>
					<ChevronLeft aria-hidden="true" />
					{back.label}
				</a>
			) : null}
			{breadcrumbs !== undefined ? (
				<div className="v-page-header__breadcrumbs">{breadcrumbs}</div>
			) : null}
			<div className="v-page-header__row">
				<div className="v-page-header__heading">
					<div className="v-page-header__title-line">
						<h1 className="v-page-header__title">{title}</h1>
						{status !== undefined ? (
							<span className="v-page-header__status">{status}</span>
						) : null}
						{compactSummary !== undefined ? (
							<span className="v-page-header__summary">{compactSummary}</span>
						) : null}
					</div>
					{meta !== undefined ? <p className="v-page-header__meta">{meta}</p> : null}
					{description !== undefined ? (
						<p className="v-page-header__description">{description}</p>
					) : null}
				</div>
				{actions !== undefined || primaryAction !== undefined ? (
					<div className="v-page-header__actions">
						{actions !== undefined ? (
							<div className="v-page-header__secondary">{actions}</div>
						) : null}
						{primaryAction !== undefined ? (
							<div className="v-page-header__primary">{primaryAction}</div>
						) : null}
					</div>
				) : null}
			</div>
			{tabs !== undefined ? <div className="v-page-header__tabs">{tabs}</div> : null}
		</header>
	);
}
