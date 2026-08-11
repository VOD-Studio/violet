/**
 * CommentSection - 评论区容器（布局壳）
 *
 * 文章评论与推文评论共用：标题行 + 匿名黑洞引导（可选）+ 顶部表单（feature 提供）+ 列表区。
 * 数据获取与表单由 feature 层负责（各自 React Query hooks），本组件纯展示。
 */
import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

export interface CommentSectionProps {
	/** 标题（feature 拼好，如「评论 (12)」） */
	title: ReactNode;
	/** 顶部表单（feature 提供） */
	form: ReactNode;
	/** 是否登录 */
	isLoggedIn: boolean;
	/** 匿名黑洞模式（文章评论）：未登录不渲染列表区 */
	blackhole?: boolean;
	/** 匿名黑洞引导条（blackhole 且未登录时渲染；文章专属） */
	banner?: ReactNode;
	/** 列表区（feature 包 CommentList / ReactionProvider） */
	children: ReactNode;
}

export function CommentSection({
	title,
	form,
	isLoggedIn,
	blackhole = false,
	banner,
	children,
}: CommentSectionProps) {
	return (
		<section className="min-w-0 max-w-3xl flex-1" aria-label="评论区">
			<header className="mb-6 flex items-center gap-2">
				<MessageSquare className="size-5 text-muted-foreground" />
				<h2 className="text-lg font-semibold text-foreground">{title}</h2>
			</header>

			{blackhole && !isLoggedIn && banner}

			<div className="mb-8">{form}</div>

			{(!blackhole || isLoggedIn) && children}
		</section>
	);
}

export default CommentSection;
