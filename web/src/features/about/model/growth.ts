import { formatDate } from "@shared/lib/date";

const dayMs = 86_400_000;
const weekDays = 7;
const windowDays = 32 * weekDays;
const timeZone = "Asia/Shanghai";
const numberFormat = new Intl.NumberFormat("zh-CN");

interface GrowthCommit {
	sha: string;
	title: string;
	url: string;
	occurred_at: string;
}

/** 公开的 GitHub 发布；日期是实际发布时间。 */
export interface GrowthRelease {
	tag: string;
	title: string;
	url: string;
	occurred_at: string;
}

/** 陈旧快照可以同时携带最近一次同步的失败原因。 */
interface GrowthHealth {
	state: "unconfigured" | "syncing" | "ready" | "stale" | "limited" | "failed";
	reason: "limited" | "failed" | null;
	last_synced_at: string | null;
}

/** 站点发布仓库的公开快照；回填完成前不能据此推断最早日期或空窗。 */
export interface GardenGrowth {
	today: string;
	elapsed_days: number | null;
	history_complete: boolean;
	first_commit: GrowthCommit | null;
	weeks: { start: string; commit_count: number }[];
	releases: GrowthRelease[];
	health: GrowthHealth;
}

/** 图层与可访问视图共用的一个上海日历周。 */
export interface GrowthWeek {
	start: number;
	commitCount: number;
	releases: GrowthRelease[];
}

/** 一次最多画 32 周；绝对日期不随手机宽度、时区或历史长度漂移。 */
export interface GrowthPeriod {
	weeks: GrowthWeek[];
	previous: string | undefined;
	next: string | undefined;
	start: number;
	end: number;
	oldestDay: number;
	today: number;
	firstCommitDay: number | null;
	firstReleaseDay: number | null;
	maxCommitCount: number;
}

/** 固定为站点时区的日历序号，不受浏览器时区和夏令时影响。 */
export function growthDay(instant: string) {
	return Date.parse(formatDate(instant, "iso-date", "", timeZone)) / dayMs;
}

/** 供标尺计算和日期格式化，输入为无时区的日历序号。 */
export function growthDate(day: number) {
	return new Date(day * dayMs);
}

function dateKey(day: number) {
	return growthDate(day).toISOString().slice(0, 10);
}

function monday(day: number) {
	return day - ((growthDate(day).getUTCDay() + 6) % weekDays);
}

/** 包含年份的站点日期；用于里程碑和辅助技术的日期范围。 */
export function growthDayLabel(day: number) {
	return formatDate(dateKey(day), "long-date");
}

/** 日历周只预览到本站今天，不宣称未来几天已发生。 */
export function growthWeekLabel(week: GrowthWeek, today: number) {
	return `${growthDayLabel(week.start)} 至 ${growthDayLabel(Math.min(week.start + 6, today))}`;
}

/** 展示请求日期所在的时段，缺省为最近时段；无任何活动时不绘制时间轴。 */
export function buildGrowthPeriod(
	growth: GardenGrowth,
	requestedDate?: string,
): GrowthPeriod | null {
	if (!growth.history_complete) return null;
	const firstCommitDay = growth.first_commit ? growthDay(growth.first_commit.occurred_at) : null;
	const oldestRelease = growth.releases.at(-1);
	const firstReleaseDay = oldestRelease ? growthDay(oldestRelease.occurred_at) : null;
	if (firstCommitDay === null && firstReleaseDay === null) return null;

	const today = growthDay(growth.today);
	const oldestDay = Math.min(firstCommitDay ?? today, firstReleaseDay ?? today);
	const oldestWeek = monday(oldestDay);
	const latestWeek = monday(today);
	const requested = requestedDate ? growthDay(requestedDate) : today;
	const requestedWeek = monday(
		Number.isFinite(requested) ? Math.max(oldestDay, Math.min(today, requested)) : today,
	);
	const offset = Math.floor((latestWeek - requestedWeek) / windowDays) * windowDays;
	const lastWeek = latestWeek - offset;
	const start = Math.max(oldestWeek, lastWeek - windowDays + weekDays);
	const end = Math.min(today, lastWeek + 6);
	const weeks: GrowthWeek[] = [];
	for (let day = start; day <= lastWeek; day += weekDays) {
		weeks.push({ start: day, commitCount: 0, releases: [] });
	}
	let maxCommitCount = 0;
	for (const week of growth.weeks) {
		maxCommitCount = Math.max(maxCommitCount, week.commit_count);
		const index = (Date.parse(week.start) / dayMs - start) / weekDays;
		const target = weeks[index];
		if (target) target.commitCount = week.commit_count;
	}
	for (const release of growth.releases) {
		const day = growthDay(release.occurred_at);
		if (day < start || day > end) continue;
		weeks[Math.floor((day - start) / weekDays)]?.releases.push(release);
	}

	return {
		weeks,
		previous: start > oldestWeek ? dateKey(start - weekDays) : undefined,
		next: lastWeek < latestWeek ? dateKey(lastWeek + weekDays) : undefined,
		start,
		end,
		oldestDay,
		today,
		firstCommitDay,
		firstReleaseDay,
		maxCommitCount,
	};
}

/** 页首、周详情与提示的数字采用同一千分位格式。 */
export function growthNumber(value: number) {
	return numberFormat.format(value);
}
