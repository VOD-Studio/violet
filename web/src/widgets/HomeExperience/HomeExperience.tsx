import { HOME_FOOTPRINT_AGGREGATION_DEFAULT_DAYS } from "@features/settings/model/types";

import { HomeAccumulation } from "./HomeAccumulation";
import { HomeClosing } from "./HomeClosing";
import { HomeIndex } from "./HomeIndex";
import { HomePrelude } from "./HomePrelude";
import {
	buildHomeAccumulationPublications,
	buildHomePublications,
	selectHomeLead,
} from "./home-content";
import type { HomeSnapshot } from "./types";

interface HomeExperienceProps {
	snapshot: HomeSnapshot;
}

/** Violet 首页按身份、动态、时间与探索顺序组织。 */
export function HomeExperience({ snapshot }: HomeExperienceProps) {
	const publications = buildHomePublications(snapshot);
	const footprintEnabled = snapshot.settings?.home_footprint_enabled ?? true;
	const accumulationPublications = footprintEnabled
		? buildHomeAccumulationPublications(publications, snapshot.archiveArticles)
		: [];
	const footprintAggregationDays =
		snapshot.settings?.home_footprint_aggregation_days ??
		HOME_FOOTPRINT_AGGREGATION_DEFAULT_DAYS;

	const lead = selectHomeLead(publications);

	return (
		<div className="home-surface overflow-clip bg-background text-foreground">
			<HomePrelude settings={snapshot.settings} lead={lead} postTotal={snapshot.postTotal} />
			<HomeIndex items={publications} tweets={snapshot.tweets} />
			{footprintEnabled ? (
				<HomeAccumulation
					publications={accumulationPublications}
					aggregationDays={footprintAggregationDays}
				/>
			) : null}
			<HomeClosing settings={snapshot.settings} />
		</div>
	);
}
