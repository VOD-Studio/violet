import { HomeAccumulation } from "./HomeAccumulation";
import { HomeClosing } from "./HomeClosing";
import { HomeIndex } from "./HomeIndex";
import { HomePrelude } from "./HomePrelude";
import { buildHomePublications, selectHomeLead } from "./home-content";
import type { HomeSnapshot } from "./types";

interface HomeExperienceProps {
	snapshot: HomeSnapshot;
}

/** Violet 首页按身份、动态、时间与探索顺序组织。 */
export function HomeExperience({ snapshot }: HomeExperienceProps) {
	const publications = buildHomePublications(snapshot);
	const lead = selectHomeLead(publications);

	return (
		<div className="home-surface overflow-clip bg-background text-foreground">
			<HomePrelude settings={snapshot.settings} lead={lead} postTotal={snapshot.postTotal} />
			<HomeIndex items={publications} tweets={snapshot.tweets} />
			<HomeAccumulation publications={publications} />
			<HomeClosing settings={snapshot.settings} />
		</div>
	);
}
