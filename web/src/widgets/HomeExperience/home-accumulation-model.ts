import type { HomePublicationItem, PublicationWindow } from "./types";

export type AccumulationSeasonName = "spring" | "summer" | "autumn" | "winter";

export interface AccumulationMonth {
	key: string;
	month: number;
	year: number;
	count: number;
	startsAt: number;
}

export interface AccumulationPoint {
	key: string;
	position: number;
	items: HomePublicationItem[];
	startsAt: number;
	endsAt: number;
	markerSize: number;
	isLatest: boolean;
	order: number;
}

export interface AccumulationSeasonLabel {
	key: string;
	name: AccumulationSeasonName;
	label: string;
	position: number;
}

export interface AccumulationTimeline {
	months: AccumulationMonth[];
	points: AccumulationPoint[];
	seasonLabels: AccumulationSeasonLabel[];
	latest: HomePublicationItem | null;
}

export const PUBLICATION_MARKER_MIN_SIZE = 5;
export const PUBLICATION_MARKER_MAX_SIZE = 10;

const DAY_IN_MILLISECONDS = 86_400_000;
const TIMELINE_MONTH_COUNT = 12;
const AGGREGATION_DEFAULT_DAYS = 7;
const AGGREGATION_MIN_DAYS = 1;
const AGGREGATION_MAX_DAYS = 31;
const SEASON_LABELS: Record<AccumulationSeasonName, string> = {
	spring: "春",
	summer: "夏",
	autumn: "秋",
	winter: "冬",
};

interface DatedPublication {
	item: HomePublicationItem;
	day: number;
}

interface PublicationBucket {
	index: number;
	startsAt: number;
	endsAt: number;
	entries: DatedPublication[];
}

interface SeasonSegment {
	key: string;
	name: AccumulationSeasonName;
	startsAt: number;
	endsAt: number;
}

/**
 * 将当前自然月及其之前十一个自然月的内容聚合到连续时间线。
 *
 * @param publications 公开发布物，顺序不影响月份、季节与节点计算。
 * @param aggregationDays 每个节点覆盖的自然日数，非法值回退为 7。
 * @param referenceDate 决定十二个月窗口的当前日期，默认浏览时刻。
 * @returns 月份、季节、聚合节点与窗口内最新发布物。
 */
export function buildAccumulationTimeline(
	publications: HomePublicationItem[],
	aggregationDays = AGGREGATION_DEFAULT_DAYS,
	referenceDate = new Date(),
): AccumulationTimeline {
	const datedPublications = publications.flatMap((item) => {
		const day = parsePublicationDay(item.published_at);
		return day === null ? [] : [{ item, day }];
	});
	if (datedPublications.length === 0) return emptyTimeline();

	const months = buildMonths(referenceDate);
	const firstMonth = months[0];
	const lastMonth = months.at(-1);
	if (!firstMonth || !lastMonth) return emptyTimeline();

	const rangeStart = firstMonth.startsAt;
	const rangeEnd = monthAfter(lastMonth);
	const timelineDuration = Math.max(rangeEnd - rangeStart, 1);
	const safeAggregationDays = clamp(
		Math.trunc(aggregationDays) || AGGREGATION_DEFAULT_DAYS,
		AGGREGATION_MIN_DAYS,
		AGGREGATION_MAX_DAYS,
	);
	const windowDuration = safeAggregationDays * DAY_IN_MILLISECONDS;
	const monthByKey = new Map(months.map((month) => [month.key, month]));
	const buckets = new Map<number, PublicationBucket>();
	let latestEntry: DatedPublication | null = null;

	for (const entry of datedPublications) {
		if (entry.day < rangeStart || entry.day >= rangeEnd) continue;
		const date = new Date(entry.day);
		const monthKey = formatMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
		const month = monthByKey.get(monthKey);
		if (!month) continue;

		month.count += 1;
		if (!latestEntry || entry.day > latestEntry.day) latestEntry = entry;

		const bucketIndex = Math.floor((entry.day - rangeStart) / windowDuration);
		const bucketStartsAt = rangeStart + bucketIndex * windowDuration;
		const bucket = buckets.get(bucketIndex) ?? {
			index: bucketIndex,
			startsAt: bucketStartsAt,
			endsAt: Math.min(bucketStartsAt + windowDuration, rangeEnd),
			entries: [],
		};
		bucket.entries.push(entry);
		buckets.set(bucketIndex, bucket);
	}

	const points = [...buckets.values()]
		.sort((left, right) => left.index - right.index)
		.map<AccumulationPoint>((bucket, order) => {
			const items = bucket.entries
				.sort((left, right) => right.day - left.day)
				.map((entry) => entry.item);
			const midpoint = bucket.startsAt + (bucket.endsAt - bucket.startsAt) / 2;
			return {
				key: `window-${bucket.index}`,
				position: clamp(((midpoint - rangeStart) / timelineDuration) * 100, 0.5, 99.5),
				items,
				startsAt: bucket.startsAt,
				endsAt: bucket.endsAt - DAY_IN_MILLISECONDS,
				markerSize: markerSizeForCount(items.length),
				isLatest: items.some((item) => item.id === latestEntry?.item.id),
				order,
			};
		});

	return {
		months,
		points,
		seasonLabels: buildSeasonLabels(months, rangeStart, timelineDuration),
		latest: latestEntry?.item ?? null,
	};
}

/**
 * 生成当前自然月向前十二个月的 UTC 半开查询区间。
 *
 * @param referenceDate 决定当前自然月的日期，默认浏览时刻。
 * @returns `from` 含首月首日，`to` 不含下月首日。
 */
export function recentTwelveMonthWindow(referenceDate = new Date()): PublicationWindow {
	const year = referenceDate.getUTCFullYear();
	const month = referenceDate.getUTCMonth();
	return {
		from: new Date(Date.UTC(year, month - (TIMELINE_MONTH_COUNT - 1), 1)).toISOString(),
		to: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
	};
}

function buildMonths(anchorDate: Date): AccumulationMonth[] {
	return Array.from({ length: TIMELINE_MONTH_COUNT }, (_, index) => {
		const date = new Date(
			Date.UTC(
				anchorDate.getUTCFullYear(),
				anchorDate.getUTCMonth() - (TIMELINE_MONTH_COUNT - 1 - index),
				1,
			),
		);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		return {
			key: formatMonthKey(year, month),
			month,
			year,
			count: 0,
			startsAt: date.getTime(),
		};
	});
}

function buildSeasonLabels(
	months: AccumulationMonth[],
	rangeStart: number,
	timelineDuration: number,
): AccumulationSeasonLabel[] {
	const segments: SeasonSegment[] = [];
	for (const month of months) {
		const name = seasonForMonth(month.month);
		const previous = segments.at(-1);
		if (previous?.name === name) {
			previous.endsAt = monthAfter(month);
			continue;
		}
		segments.push({
			key: `${name}-${month.key}`,
			name,
			startsAt: month.startsAt,
			endsAt: monthAfter(month),
		});
	}

	const longestSegmentBySeason = new Map<AccumulationSeasonName, SeasonSegment>();
	for (const segment of segments) {
		const current = longestSegmentBySeason.get(segment.name);
		if (!current || segment.endsAt - segment.startsAt > current.endsAt - current.startsAt) {
			longestSegmentBySeason.set(segment.name, segment);
		}
	}

	return [...longestSegmentBySeason.values()]
		.sort((left, right) => left.startsAt - right.startsAt)
		.map((segment) => ({
			key: segment.key,
			name: segment.name,
			label: SEASON_LABELS[segment.name],
			position: clamp(
				((segment.startsAt + (segment.endsAt - segment.startsAt) / 2 - rangeStart) /
					timelineDuration) *
					100,
				1,
				99,
			),
		}));
}

function markerSizeForCount(count: number): number {
	const size = PUBLICATION_MARKER_MIN_SIZE + Math.sqrt(Math.max(count - 1, 0)) * 1.4;
	return Math.round(clamp(size, PUBLICATION_MARKER_MIN_SIZE, PUBLICATION_MARKER_MAX_SIZE));
}

function seasonForMonth(month: number): AccumulationSeasonName {
	if (month >= 3 && month <= 5) return "spring";
	if (month >= 6 && month <= 8) return "summer";
	if (month >= 9 && month <= 11) return "autumn";
	return "winter";
}

function parsePublicationDay(value: string): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		const dayOfMonth = Number(match[3]);
		const day = Date.UTC(year, month - 1, dayOfMonth);
		const parsed = new Date(day);
		if (
			parsed.getUTCFullYear() === year &&
			parsed.getUTCMonth() === month - 1 &&
			parsed.getUTCDate() === dayOfMonth
		) {
			return day;
		}
	}

	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return null;
	const parsed = new Date(timestamp);
	return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function emptyTimeline(): AccumulationTimeline {
	return { months: [], points: [], seasonLabels: [], latest: null };
}

function monthAfter(month: AccumulationMonth): number {
	return Date.UTC(month.year, month.month, 1);
}

function formatMonthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
