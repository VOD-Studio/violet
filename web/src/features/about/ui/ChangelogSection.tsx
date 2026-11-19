import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Skeleton } from "@violet/ui";
import { gardenGrowthQueryOptions } from "../api/growth";
import { growthDay, growthDayLabel } from "../model/growth";

import { AboutChapter } from "./AboutChapter";
import { AboutSectionState } from "./AboutSectionState";
import styles from "./AboutSections.module.css";

/** 最近发布和生长图的花苞来自同一份公开快照。 */
export function ChangelogSection() {
	const { data, isPending, isError, isFetching, refetch } = useQuery(gardenGrowthQueryOptions());
	const releases = data?.releases.slice(0, 4);

	return (
		<AboutChapter id="changelog" title="最近开的花">
			{isPending ? (
				<Skeleton className={styles.loadingRelease} />
			) : isError ? (
				<AboutSectionState
					message="暂时无法读取最近发布。"
					isRetrying={isFetching}
					onRetry={() => void refetch()}
				/>
			) : !releases?.length ? (
				<AboutSectionState message="还没有已同步的公开版本。" />
			) : (
				<ul className={styles.releaseList}>
					{releases.map((release) => (
						<li key={release.url}>
							<a className={styles.releaseRow} href={release.url}>
								<span className={styles.releaseVersion}>{release.tag}</span>
								<span className={styles.releaseDetail}>
									{release.title !== release.tag && <span>{release.title}</span>}
									<time dateTime={release.occurred_at}>
										{growthDayLabel(growthDay(release.occurred_at))}
									</time>
								</span>
							</a>
						</li>
					))}
				</ul>
			)}
			<Button className="mt-5" variant="outline" size="sm" asChild>
				<Link to="/changelog">查看完整更新日志</Link>
			</Button>
		</AboutChapter>
	);
}
