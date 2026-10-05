import type { PostDetail } from "@entities/post/model/types";
import { formatDate } from "@shared/lib/date";
import { AvatarGroup } from "@shared/ui/avatar-group";
import { BackLink } from "@shared/ui/back-link";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Calendar, ExternalLink, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { RevisionChip } from "./RevisionChip";

export interface PostDetailHeaderProps {
	post: PostDetail;
	viewCount: number;
	/** 放在标签与标题之间的文章归属信息。 */
	children?: ReactNode;
}

/** 返回入口、文章元信息与封面共用正文列宽。 */
export function PostDetailHeader({ post, viewCount, children }: PostDetailHeaderProps) {
	return (
		<div className="min-w-0 xl:max-w-230">
			<BackLink to="/blog" label="博客" className="mb-8" history />
			<header className="mb-12 text-center">
				{post.tags.length > 0 ? (
					<div className="mb-4 flex flex-wrap justify-center gap-2">
						{post.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
							>
								#{tag}
							</span>
						))}
					</div>
				) : null}
				{children}
				<h1 className="mb-3 text-balance font-mono text-3xl font-bold leading-tight tracking-tight md:text-4xl">
					{post.title}
				</h1>
				{post.canonical_url ? (
					<a
						href={post.canonical_url}
						target="_blank"
						rel="noopener noreferrer external"
						className="mb-5 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ExternalLink className="size-3.5" />
						转载自 · {sourceHostname(post.canonical_url)}
					</a>
				) : null}
				<div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
					{post.author ? (
						<span className="inline-flex items-center gap-1.5">
							<AvatarGroup
								users={[post.author, ...(post.collaborators ?? [])]}
								size="sm"
							/>
							<span>{post.author.username}</span>
						</span>
					) : null}
					{post.published_at ? (
						<span className="inline-flex items-center gap-1.5">
							<Calendar className="size-3.5" />
							<span>{formatDate(post.published_at, "long-date")}</span>
							{post.edited_at ? <RevisionChip post={post} /> : null}
						</span>
					) : post.edited_at ? (
						<span className="inline-flex items-center gap-1.5">
							<Calendar className="size-3.5" />
							<RevisionChip post={post} standalone />
						</span>
					) : null}
					<span className="inline-flex items-center gap-1.5">
						<Eye className="size-3.5" />
						{viewCount} 次阅读
					</span>
				</div>
			</header>
			{post.cover_image ? (
				<div
					className="mb-9 overflow-hidden rounded-2xl"
					style={{ viewTransitionName: "post-cover" }}
				>
					<CroppedImage
						src={post.cover_image}
						width={1400}
						alt={post.title}
						className="aspect-2/1 w-full"
					/>
				</div>
			) : null}
		</div>
	);
}

function sourceHostname(canonicalUrl: string): string {
	try {
		const url = new URL(canonicalUrl);
		return url.hostname || canonicalUrl;
	} catch {
		return canonicalUrl;
	}
}
