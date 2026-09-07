import { useTimeline } from "@features/tweets/api/queries";

import { useFootprintPublications, useRecentPublications, useSiteIdentity } from "./api/queries";
import { HomeAccumulation } from "./HomeAccumulation";
import { HomeAccumulationSkeleton } from "./HomeAccumulationSkeleton";
import { HomeClosing } from "./HomeClosing";
import { HomeIndex } from "./HomeIndex";
import { HomePrelude } from "./HomePrelude";
import { selectHomeLead } from "./home-content";
import type { SiteIdentity } from "./types";

interface HomeExperienceProps {
	initialRecentPublicationsFailed: boolean;
}

const FALLBACK_SITE_IDENTITY: SiteIdentity = {
	site_name: "Violet",
	site_url: "https://xunrua.top",
	owner_name: "xunrua",
	bio: "这里是 Violet，记录构建、拆解问题与生活思考。",
	avatar_url: "",
	location: "",
	hero: {
		banner_url: null,
		quote: "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
		quote_translation: "「我们只能看清眼前的一小段路，但已足以看清有无数的事亟待完成。」",
		quote_author: "Alan Turing",
	},
	social_links: [],
	subscription_channels: [{ kind: "rss", label: "RSS", href: "/feed.xml" }],
	home: {
		footprint_enabled: true,
		footprint_aggregation_days: 7,
	},
};

/** Violet 首页按身份、动态、时间与探索顺序组织。 */
export function HomeExperience({ initialRecentPublicationsFailed }: HomeExperienceProps) {
	const identityQuery = useSiteIdentity();
	const identity = identityQuery.data ?? FALLBACK_SITE_IDENTITY;
	const recentPublicationsQuery = useRecentPublications();
	const recentPublications = recentPublicationsQuery.data?.data ?? [];
	const footprintQuery = useFootprintPublications(identity.home.footprint_enabled);
	const timelineQuery = useTimeline(3, typeof document !== "undefined");
	const tweets = timelineQuery.data?.pages.flatMap((page) => page.data ?? []) ?? [];
	const publicationError =
		recentPublicationsQuery.data === undefined &&
		(initialRecentPublicationsFailed || recentPublicationsQuery.isError);
	const lead = selectHomeLead(recentPublications);

	return (
		<div className="home-surface overflow-clip bg-background text-foreground">
			<HomePrelude identity={identity} lead={lead} />
			<HomeIndex
				items={recentPublications}
				tweets={tweets}
				publicationError={publicationError}
				publicationRetrying={recentPublicationsQuery.isFetching}
				onRetryPublications={() => void recentPublicationsQuery.refetch()}
				tweetsLoading={timelineQuery.isPending}
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
							className="mt-3 text-primary transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
			<HomeClosing identity={identity} />
		</div>
	);
}
