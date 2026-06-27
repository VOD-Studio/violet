import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import type { Post } from "../model/types";

/**
 * PostCardProps - PostCard 组件属性
 */
export interface PostCardProps {
    /** 文章数据 */
    post: Post;
    /**
     * 卡片视觉尺寸变体，支持虚拟列表大小不一不崩塌
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
}

/**
 * PostCard - 文章卡片（Nexus Spotlight 版）
 *
 * spec：
 * - 全局边缘聚光灯（SpotlightCard）冷光跟随鼠标揭示材质边界
 * - 支持 sm/md/lg 三种高度，虚拟列表混排不崩塌
 * - 封面懒加载 + hover 图片放大（transform 不引起 reflow）
 * - 标签最多 3 个，相对时间
 *
 * 仍消费现有 Post 类型（features/posts/model），不动数据层。
 */
const PostCard = ({ post, size = "md" }: PostCardProps) => {
    const coverH = size === "lg" ? "h-56" : size === "sm" ? "h-32" : "h-44";

    return (
        <SpotlightCard className="group flex h-full flex-col">
            {post.cover_image ? (
                <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="block overflow-hidden"
                >
                    <img
                        src={post.cover_image}
                        alt={post.title}
                        loading="lazy"
                        className={`w-full ${coverH} object-cover transition-transform duration-500 group-hover:scale-105`}
                    />
                </Link>
            ) : null}

            <div className="flex flex-1 flex-col p-5">
                {post.tags.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-edge-hairline bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}

                <h3 className="mb-2 line-clamp-2 text-lg font-semibold leading-snug">
                    <Link
                        to="/blog/$slug"
                        params={{ slug: post.slug }}
                        className="transition-colors hover:text-neon-blue"
                    >
                        {post.title}
                    </Link>
                </h3>

                <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {post.excerpt}
                </p>

                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        {post.author.avatar_url ? (
                            <img
                                src={post.author.avatar_url}
                                alt=""
                                className="size-4 rounded-full"
                                loading="lazy"
                            />
                        ) : null}
                        {post.author.username}
                    </span>
                    <time>
                        {formatDistanceToNow(new Date(post.published_at), {
                            addSuffix: true,
                            locale: zhCN,
                        })}
                    </time>
                </div>
            </div>
        </SpotlightCard>
    );
};

export default PostCard;
