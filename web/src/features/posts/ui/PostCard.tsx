import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import type { Post } from "../model/types";

/**
 * PostCardProps - PostCard 组件属性
 */
export interface PostCardProps {
	/**
	 * 文章数据
	 */
	post: Post;
}

/**
 * PostCard - 文章卡片
 *
 * 用于首页文章列表的单条展示。
 *
 * 支持：
 * - 封面图懒加载
 * - Hover 动画（图片放大 + 阴影增强）
 * - 标签徽章（最多显示前 3 个）
 * - 相对时间显示（如 "3 天前"）
 */
const PostCard = ({ post }: PostCardProps) => {
	return (
		<article className="group rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-lg">
			{post.cover_image ? (
				<Link to="/blog/$slug" params={{ slug: post.slug }}>
					<img
						src={post.cover_image}
						alt={post.title}
						loading="lazy"
						className="w-full h-48 object-cover transition-transform group-hover:scale-105"
					/>
				</Link>
			) : null}
			<div className="p-5">
				{post.tags.length > 0 ? (
					<div className="flex gap-2 mb-2">
						{post.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				) : null}
				<h3 className="text-lg font-semibold mb-2 line-clamp-2">
					<Link
						to="/blog/$slug"
						params={{ slug: post.slug }}
						className="hover:text-primary"
					>
						{post.title}
					</Link>
				</h3>
				<p className="text-sm text-muted-foreground line-clamp-2 mb-3">
					{post.excerpt}
				</p>
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>{post.author.username}</span>
					<time>
						{formatDistanceToNow(new Date(post.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</time>
				</div>
			</div>
		</article>
	);
};

export default PostCard;
