import { useActivePersona } from "@entities/persona/api/queries";
import { siteIdentityQueryOptions } from "@entities/site-identity/api/queries";
import { useLatestComments } from "@features/comments/api/queries";
import { useTimeline } from "@features/tweets/api/queries";
import type { Season } from "@shared/lib/theme-preference";
import { useSuspenseQuery } from "@tanstack/react-query";

import { useFootprintPublications, useRecentPublications } from "./api/queries";
import { HomeAccumulation } from "./HomeAccumulation";
import { HomeAccumulationSkeleton } from "./HomeAccumulationSkeleton";
import { HomeClosing } from "./HomeClosing";
import { HomeIndex } from "./HomeIndex";
import { HomePrelude } from "./HomePrelude";

interface HomeExperienceProps {
	initialRecentPublicationsFailed: boolean;
	/** 当前预设主题的季节 */
	season: Season;
}

/** Violet 首页按身份、动态、时间与探索顺序组织。 */
export function HomeExperience({ initialRecentPublicationsFailed, season }: HomeExperienceProps) {
	const { data: identity } = useSuspenseQuery(siteIdentityQueryOptions());
	const persona = useActivePersona().data ?? null;
	const recentPublicationsQuery = useRecentPublications();
	const recentPublications = recentPublicationsQuery.data?.data ?? [];
	const footprintQuery = useFootprintPublications(identity.home.footprint_enabled);
	const timelineQuery = useTimeline(3, typeof document !== "undefined");
	const tweets = timelineQuery.data?.pages.flatMap((page) => page.data ?? []) ?? [];
	// 多取两把滤掉纯图评论（body 为空的附图评论不进橱窗）
	const latestCommentsQuery = useLatestComments(4, {
		enabled: typeof document !== "undefined",
	});
	const missives = (latestCommentsQuery.data ?? [])
		.filter((comment) => comment.body.trim().length > 0)
		.slice(0, 2);
	const publicationError =
		recentPublicationsQuery.data === undefined &&
		(initialRecentPublicationsFailed || recentPublicationsQuery.isError);
	const lead = recentPublications[0] ?? null;

	return (
		<div className="overflow-clip text-foreground">
			<HomePrelude
				identity={identity}
				lead={lead}
				persona={persona}
				publicationError={publicationError}
				publicationsLoading={recentPublicationsQuery.isPending}
				publicationsRetrying={recentPublicationsQuery.isFetching}
				onRetryPublications={() => void recentPublicationsQuery.refetch()}
			/>
			<HomeIndex
				items={recentPublications}
				tweets={tweets}
				publicationError={publicationError}
				publicationRetrying={recentPublicationsQuery.isFetching}
				onRetryPublications={() => void recentPublicationsQuery.refetch()}
				tweetsLoading={timelineQuery.isPending}
				missives={missives}
				missivesLoading={latestCommentsQuery.isPending}
			/>
			{identity.home.footprint_enabled ? (
				footprintQuery.isPending ? (
					<HomeAccumulationSkeleton />
				) : footprintQuery.isError ? (
					<section
						role="alert"
						className="mx-auto max-w-7xl px-5 pt-20 text-center text-sm text-muted-foreground sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
					>
						<p>最近十二个月的足迹暂时未能抵达。</p>
						<button
							type="button"
							onClick={() => void footprintQuery.refetch()}
							className="mt-3 text-link transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							重新获取足迹
						</button>
					</section>
				) : (
					<HomeAccumulation
						publications={footprintQuery.data}
						aggregationDays={identity.home.footprint_aggregation_days}
					/>
				)
			) : null}
			<HomeClosing identity={identity} season={season} />
		</div>
	);
}
