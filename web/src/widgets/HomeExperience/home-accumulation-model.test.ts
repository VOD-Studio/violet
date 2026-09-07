import { describe, expect, it } from "vitest";

import {
	buildAccumulationTimeline,
	PUBLICATION_MARKER_MAX_SIZE,
	PUBLICATION_MARKER_MIN_SIZE,
	recentTwelveMonthWindow,
} from "./home-accumulation-model";
import type { HomePublicationItem } from "./types";

const DAY_IN_MILLISECONDS = 86_400_000;

function publication(day: number, index: number): HomePublicationItem {
	return {
		id: `article:${index}`,
		kind: "article",
		route_key: `article-${index}`,
		title: `第 ${index + 1} 篇文章`,
		published_at: new Date(day).toISOString(),
		featured: false,
	};
}

describe("buildAccumulationTimeline", () => {
	it("每天发布时按七日窗口收敛节点并保留全部内容", () => {
		const startsAt = Date.UTC(2025, 9, 1);
		const publications = Array.from({ length: 365 }, (_, index) =>
			publication(startsAt + index * DAY_IN_MILLISECONDS, index),
		).reverse();

		const timeline = buildAccumulationTimeline(
			publications,
			7,
			new Date("2026-09-20T12:00:00Z"),
		);
		const items = timeline.points.flatMap((point) => point.items);

		expect(items).toHaveLength(365);
		expect(timeline.points.length).toBeLessThan(60);
		expect(Math.max(...timeline.points.map((point) => point.items.length))).toBeLessThanOrEqual(
			7,
		);
		expect(timeline.seasonLabels.map((season) => season.name)).toEqual([
			"autumn",
			"winter",
			"spring",
			"summer",
		]);
		expect(
			timeline.points.every(
				(point) =>
					point.markerSize >= PUBLICATION_MARKER_MIN_SIZE &&
					point.markerSize <= PUBLICATION_MARKER_MAX_SIZE,
			),
		).toBe(true);
	});

	it("单篇与集中发布分别命中节点尺寸下限和上限", () => {
		const latestDay = Date.UTC(2026, 8, 20);
		const publications = [
			...Array.from({ length: 30 }, (_, index) => publication(latestDay, index)),
			publication(Date.UTC(2026, 7, 1), 31),
		];

		const points = buildAccumulationTimeline(
			publications,
			7,
			new Date("2026-09-20T12:00:00Z"),
		).points;
		const burst = points.find((point) => point.items.length === 30);
		const single = points.find((point) => point.items.length === 1);

		expect(burst?.markerSize).toBe(PUBLICATION_MARKER_MAX_SIZE);
		expect(single?.markerSize).toBe(PUBLICATION_MARKER_MIN_SIZE);
	});

	it("按配置天数改变节点密度而不丢失发布内容", () => {
		const startsAt = Date.UTC(2026, 10, 27);
		const publications = Array.from({ length: 30 }, (_, index) =>
			publication(startsAt + index * DAY_IN_MILLISECONDS, index),
		);

		const referenceDate = new Date("2026-12-26T12:00:00Z");
		const daily = buildAccumulationTimeline(publications, 1, referenceDate);
		const tenDay = buildAccumulationTimeline(publications, 10, referenceDate);

		expect(daily.points).toHaveLength(30);
		expect(tenDay.points).toHaveLength(3);
		expect(tenDay.points.flatMap((point) => point.items)).toHaveLength(30);
	});

	it("以当前自然月为锚并排除半开区间边界外内容", () => {
		const referenceDate = new Date("2026-09-20T12:00:00Z");
		expect(recentTwelveMonthWindow(referenceDate)).toEqual({
			from: "2025-10-01T00:00:00.000Z",
			to: "2026-10-01T00:00:00.000Z",
		});

		const timeline = buildAccumulationTimeline(
			[
				publication(Date.UTC(2025, 8, 30), 0),
				publication(Date.UTC(2025, 9, 1), 1),
				publication(Date.UTC(2026, 8, 30), 2),
				publication(Date.UTC(2026, 9, 1), 3),
			],
			7,
			referenceDate,
		);

		expect(timeline.months[0]?.key).toBe("2025-10");
		expect(timeline.months.at(-1)?.key).toBe("2026-09");
		expect(timeline.points.flatMap((point) => point.items.map((item) => item.id))).toEqual([
			"article:1",
			"article:2",
		]);
	});
});
