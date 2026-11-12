/**
 * CommentSection - 评论区容器（布局壳）
 *
 * 文章评论与推文评论共用：标题行 + 匿名黑洞引导（可选）+ 顶部表单（feature 提供）+ 列表区。
 * 数据获取与表单由 feature 层负责（各自 React Query hooks），本组件纯展示。
 */
import { CommentHeader, type CommentSort } from "@violet/ui";
import type { ReactNode } from "react";

export interface CommentSectionProps {
	/** 标题（如「评论」；旧调用方可自行拼计数） */
	title: ReactNode;
	/** 评论总数，显示为标题旁的小圆标；缺省不显示（匿名黑洞模式看不到总数） */
	count?: number;
	/** 顶部表单（feature 提供） */
	form: ReactNode;
	/** 是否登录 */
	isLoggedIn: boolean;
	/**
	 * 匿名黑洞模式（文章评论）：未登录不渲染列表区。
	 *
	 * @default false
	 */
	blackhole?: boolean;
	/** 匿名黑洞引导条（blackhole 且未登录时渲染；文章专属） */
	banner?: ReactNode;
	/** 列表区（feature 包 CommentList / ReactionProvider） */
	children: ReactNode;
	/** 顶层评论的真实查询排序，回复会话不使用此状态。 */
	sort?: CommentSort;
	onSortChange?: (sort: CommentSort) => void;
}

export function CommentSection({
	title,
	count,
	form,
	isLoggedIn,
	blackhole = false,
	banner,
	children,
	sort,
	onSortChange,
}: CommentSectionProps) {
	return (
		<section className="min-w-0 max-w-4xl flex-1" aria-label="评论区">
			<CommentHeader
				className="mb-6"
				title={<h2>{title}</h2>}
				count={count}
				sort={sort}
				onSortChange={onSortChange}
			/>

			{blackhole && !isLoggedIn && banner}

			{form != null && <div className="mb-8">{form}</div>}

			{(!blackhole || isLoggedIn) && children}
		</section>
	);
}

export default CommentSection;
