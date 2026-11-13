import type { Post } from "@entities/post/model/types";
import { getDisplayName } from "@entities/user/model/display-name";
import { formatDate } from "@shared/lib/date";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Link } from "@tanstack/react-router";
import {
	CardFrame,
	CardFrameBody,
	CardFrameExcerpt,
	CardFrameImage,
	CardFrameMeta,
	CardFrameTitle,
	Tag,
} from "@violet/ui";

/** 只呈现当前页；精选仅在第一页提升，不重复占用列表位置。 */
export interface BlogPostGridProps {
	posts: Post[];
	highlightFeatured: boolean;
}

interface PostCardProps {
	post: Post;
}

function PostFrame({ post }: PostCardProps) {
	return (
		<article className="mb-4 break-inside-avoid p-1">
			<CardFrame>
				{post.cover_image ? (
					<CardFrameImage>
						<CroppedImage
							src={post.cover_image}
							width={640}
							alt=""
							loading="lazy"
							fillContainer
							className="h-full w-full"
						/>
					</CardFrameImage>
				) : null}
				<CardFrameBody>
					<h2>
						<CardFrameTitle asChild>
							<Link to="/blog/$slug" params={{ slug: post.slug }}>
								{post.title}
							</Link>
						</CardFrameTitle>
					</h2>
					<CardFrameMeta className="flex flex-wrap gap-x-2 gap-y-1 font-mono">
						{post.tags[0] ? <span>{post.tags[0]}</span> : null}
						<time dateTime={post.published_at}>
							{formatDate(post.published_at, "slash-date", "")}
						</time>
						<span>{post.canonical_url ? "转载" : "原创"}</span>
					</CardFrameMeta>
					{post.excerpt ? <CardFrameExcerpt>{post.excerpt}</CardFrameExcerpt> : null}
				</CardFrameBody>
			</CardFrame>
		</article>
	);
}

function FeaturedPost({ post }: PostCardProps) {
	if (!post.cover_image) {
		return (
			<CardFrame className="mb-8">
				<CardFrameBody className="p-6 md:p-10">
					<h2>
						<CardFrameTitle asChild>
							<Link to="/blog/$slug" params={{ slug: post.slug }}>
								{post.title}
							</Link>
						</CardFrameTitle>
					</h2>
					<CardFrameMeta className="mb-2 flex flex-wrap items-center gap-3">
						<Tag>精选</Tag>
						<time dateTime={post.published_at}>
							{formatDate(post.published_at, "slash-date", "")}
						</time>
					</CardFrameMeta>
					{post.excerpt ? <CardFrameExcerpt>{post.excerpt}</CardFrameExcerpt> : null}
				</CardFrameBody>
			</CardFrame>
		);
	}
	return (
		<article className="relative mb-8 rounded-2xl bg-muted">
			<div className="absolute inset-0 overflow-hidden rounded-2xl">
				<CroppedImage
					src={post.cover_image}
					width={1280}
					alt=""
					loading="eager"
					fetchPriority="high"
					fillContainer
					className="h-full w-full"
				/>
				<div className="absolute inset-0 bg-linear-to-t from-(--image-overlay-strong) via-(--image-overlay) to-transparent" />
			</div>
			<Link
				to="/blog/$slug"
				params={{ slug: post.slug }}
				className="relative flex min-h-80 flex-col justify-end rounded-2xl p-6 text-(--image-overlay-foreground) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:min-h-110 md:p-10"
			>
				<span className="mb-3 w-fit rounded-full bg-(--image-overlay) px-3 py-1 text-xs">
					精选
				</span>
				<h2 className="max-w-3xl text-2xl leading-snug font-semibold md:text-3xl">
					{post.title}
				</h2>
				{post.excerpt ? (
					<p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed">
						{post.excerpt}
					</p>
				) : null}
				<p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
					{post.author ? <span>{getDisplayName(post.author)}</span> : null}
					<time dateTime={post.published_at}>
						{formatDate(post.published_at, "slash-date", "")}
					</time>
					<span>{post.view_count} 次阅读</span>
					<span>{post.canonical_url ? "转载" : "原创"}</span>
				</p>
			</Link>
		</article>
	);
}

/** 相框卡按自然高度分列，缺封面的文章直接呈现文字，不补示例图片。 */
export function BlogPostGrid({ posts, highlightFeatured }: BlogPostGridProps) {
	const featured = highlightFeatured ? posts.find((post) => post.is_featured) : undefined;
	return (
		<>
			{featured ? <FeaturedPost post={featured} /> : null}
			<div className="-m-1 columns-1 gap-4 sm:columns-2 lg:columns-3">
				{posts.map((post) =>
					post.id === featured?.id ? null : <PostFrame key={post.id} post={post} />,
				)}
			</div>
		</>
	);
}
