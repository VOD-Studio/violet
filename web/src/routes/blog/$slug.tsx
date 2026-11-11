import { activePersonaKeys } from "@entities/persona/api/keys";
import { fetchActivePersona } from "@entities/persona/api/queries";
import type { PostDetail } from "@entities/post/model/types";
import { commentKeys } from "@features/comments/api/keys";
import { fetchAnnotationSummary } from "@features/comments/api/queries";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug } from "@features/posts/api/queries";
import { PostDetailSkeleton } from "@features/posts/ui/PostDetailSkeleton";
import { seriesKeys } from "@features/series/api/keys";
import { fetchChapterContext, fetchSeriesBySlug } from "@features/series/api/queries";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchAnnouncements, fetchSettings } from "@features/settings/api/queries";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import { BlogDetailPage } from "@widgets/BlogDetailPage";

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
		const { queryClient } = context;
		// 设置与系列归属会改变首屏版面；人设、公告及书目录不阻塞正文。
		// 所有请求在正文前并行起跑，失败留给浏览器重取；服务端不重试。
		const settings = queryClient.ensureQueryData({
			queryKey: settingsKeys.public(),
			queryFn: fetchSettings,
			retry: false,
		});
		const chapter = queryClient.ensureQueryData({
			queryKey: seriesKeys.context(params.slug),
			queryFn: () => fetchChapterContext(params.slug),
			retry: false,
		});
		const announcements = queryClient.ensureQueryData({
			queryKey: settingsKeys.announcements(),
			queryFn: fetchAnnouncements,
			retry: false,
		});
		const persona = queryClient.ensureQueryData({
			queryKey: activePersonaKeys.current(""),
			queryFn: () => fetchActivePersona(),
			retry: false,
		});
		const series = chapter.then((value) =>
			value?.series.slug
				? queryClient.prefetchQuery({
						queryKey: seriesKeys.detail(value.series.slug),
						queryFn: () => fetchSeriesBySlug(value.series.slug),
						retry: false,
					})
				: undefined,
		);
		void Promise.allSettled([announcements, persona, series]);
		const layout = Promise.allSettled([settings, chapter]);
		const post = await queryClient.ensureQueryData({
			queryKey: postKeys.detail(params.slug),
			queryFn: () => fetchPostBySlug(params.slug),
		});
		// 浏览器里导航不等版面数据：壳层的多半已在缓存，系列归属到了再补。
		if (typeof window === "undefined") await layout;
		// 批注摘要按访客身份过滤：服务端预取没有访客 cookie，只会拿到空表并作为新鲜数据脱水，
		// 登录读者刷新后看不到已有批注。只在浏览器导航时预取。
		if (post?.id && typeof window !== "undefined") {
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
