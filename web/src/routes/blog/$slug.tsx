import type { PostDetail } from "@entities/post/model/types";
import { commentKeys } from "@features/comments/api/keys";
import { fetchAnnotationSummary } from "@features/comments/api/queries";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug } from "@features/posts/api/queries";
import { PostDetailSkeleton } from "@features/posts/ui/PostDetailSkeleton";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import { BlogDetailPage } from "@widgets/BlogDetailPage/BlogDetailPage";

function BlogDetailRoute() {
	const { slug } = Route.useParams();
	return <BlogDetailPage slug={slug} initialPost={Route.useLoaderData()} />;
}

export const Route = createFileRoute("/blog/$slug")({
	staticData: { navTitle: (post: PostDetail | undefined) => post?.title },
	pendingComponent: PostDetailSkeleton,
	pendingMs: 0,
	pendingMinMs: 200,
	loader: async ({ context, params }) => {
		const post = await context.queryClient.ensureQueryData({
			queryKey: postKeys.detail(params.slug),
			queryFn: () => fetchPostBySlug(params.slug),
		});
		if (post?.id) {
			void context.queryClient.prefetchQuery({
				queryKey: commentKeys.annotationSummary(post.id),
				queryFn: () => fetchAnnotationSummary(post.id),
			});
		}
		return post;
	},
	// 动态 SEO：映射文章的 seo_title / seo_description / 封面图 / canonical
	// rel=canonical：canonical_url 非空（转载）→ 指源（避免被 Google 当抄袭降权）；
	// 空（原创）→ 自指本站绝对 URL（Google 建议 rel=canonical 用绝对地址）。
	// og:url 是本页面对象标识，始终指本站绝对 URL——转载也不把社交图谱归属让渡给源站。
	head: ({ loaderData }) => {
		const post = loaderData as PostDetail | undefined;
		if (!post) return { meta: [] };
		const pageUrl = `${SITE_URL.replace(/\/+$/, "")}/blog/${post.slug}`;
		const canonicalHref = post.canonical_url || pageUrl;
		return {
			meta: [
				{ title: post.seo_title || post.title },
				{ name: "description", content: post.seo_description || post.excerpt },
				{ property: "og:title", content: post.seo_title || post.title },
				{ property: "og:description", content: post.seo_description || post.excerpt },
				...(post.cover_image ? [{ property: "og:image", content: post.cover_image }] : []),
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: pageUrl },
			],
			links: [{ rel: "canonical", href: canonicalHref }],
		};
	},
	component: BlogDetailRoute,
});
