import { useContributions } from "@features/github/api/queries";
import {
	CONTRIBUTION_LEVEL_CLASS,
	getContributionLevel,
} from "@features/github/model/contribution-level";
import { useSettings } from "@features/settings/api/queries";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { GithubIcon } from "@shared/ui/icons";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { HeaderContributionModules } from "./HeaderContributionModules";

interface HeaderContributionCardProps {
	onNavigate?: () => void;
}

/** 热力图滚动窗口周数（约近 3 个月） */
const WEEKS_SHOWN = 13;
/** 每周天数（周日为列首，与 GitHub 贡献图一致） */
const DAYS_PER_WEEK = 7;

/** 计算距离周末（周六）天数 */
function getDaysToWeekend(now = new Date()): number {
	const day = now.getDay();
	if (day === 0) return 6; // 周日
	if (day === 6) return 0; // 周六
	return 6 - day;
}

/** 计算距离月底剩余天数 */
function getDaysToEndOfMonth(now = new Date()): number {
	const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	return lastDay - now.getDate();
}

/** 计算距离年底（12月31日）剩余天数 */
function getDaysToEndOfYear(now = new Date()): number {
	const endOfYear = new Date(now.getFullYear(), 11, 31);
	const diffTime = endOfYear.getTime() - now.getTime();
	return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/** 计算本年度已过进度百分比 */
function getYearProgress(now = new Date()): number {
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const endOfYear = new Date(now.getFullYear(), 11, 31);
	const total = endOfYear.getTime() - startOfYear.getTime();
	const current = now.getTime() - startOfYear.getTime();
	return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

interface DayCell {
	key: string;
	count: number;
}

/**
 * HeaderContributionCard - 站长开源档案与贡献卡片
 *
 * 借鉴参考站设计：
 * - 左侧：头像身份、社交矩阵与最近 3 个月（13 周 × 7 天）日粒度开源贡献热力图；
 * - 右侧：时光倒计时（距周末/月底/年底）、可跳转模块入口网格（人设等）与年度历程进度条。
 */
export function HeaderContributionCard({ onNavigate }: HeaderContributionCardProps) {
	const { data: settings } = useSettings();
	const { data: githubData } = useContributions();

	const now = useMemo(() => new Date(), []);
	const daysToWeekend = getDaysToWeekend(now);
	const daysToEndOfMonth = getDaysToEndOfMonth(now);
	const daysToEndOfYear = getDaysToEndOfYear(now);
	const yearProgress = getYearProgress(now);

	const siteName = settings?.site_name?.trim() || "Violet";
	const githubUsername = settings?.github_username?.trim() || "";
	const ownerName = githubUsername || siteName;
	const bio = settings?.bio?.trim() || settings?.tagline?.trim() || "";
	const configuredAvatar = settings?.avatar_url?.trim();
	const githubAvatar = githubUsername
		? `https://github.com/${encodeURIComponent(githubUsername)}.png?size=96`
		: "";
	const avatar = configuredAvatar ? avatarUrl(configuredAvatar, ownerName) : githubAvatar;
	const email = settings?.social_email?.trim() || "";
	const { weeks, monthTicks, todayKey } = useMemo(() => {
		const countMap = new Map<string, number>();
		for (const c of githubData?.contributions ?? []) {
			countMap.set(c.date, c.count);
		}

		// 起点 = 今天向前回推 13×7-1 天，逐日填充，末格恰好落在今天
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		start.setDate(start.getDate() - (WEEKS_SHOWN * DAYS_PER_WEEK - 1));

		const cols: DayCell[][] = [];
		const ticks: (string | null)[] = [];
		const today = toDateKey(now);
		for (let w = 0; w < WEEKS_SHOWN; w++) {
			const col: DayCell[] = [];
			for (let d = 0; d < DAYS_PER_WEEK; d++) {
				const day = new Date(start);
				day.setDate(day.getDate() + w * DAYS_PER_WEEK + d);
				const key = toDateKey(day);
				col.push({ key, count: countMap.get(key) ?? 0 });
			}
			cols.push(col);
			// 该列若包含某月 1 日，则在该列下方标注月份（对齐原版贡献图刻度行）
			const firstDay = col.at(0);
			const lastDay = col.at(-1);
			const crossesMonth =
				firstDay && lastDay && firstDay.key.slice(0, 7) !== lastDay.key.slice(0, 7);
			ticks.push(crossesMonth ? `${Number(lastDay.key.slice(5, 7))}月` : null);
		}
		return { weeks: cols, monthTicks: ticks, todayKey: today };
	}, [githubData, now]);

	const totalContributions = githubData?.total_contributions ?? 0;

	// 热力等级与配色复用原版贡献图固定阈值分档
	const getLevelClass = (count: number) => CONTRIBUTION_LEVEL_CLASS[getContributionLevel(count)];

	// 日期格式化：「9月6日 · 5 次贡献」
	const formatDayTooltip = (key: string, count: number) => {
		const [, m, d] = key.split("-");
		return `${Number(m)}月${Number(d)}日 · ${count} 次贡献`;
	};

	return (
		<div className="w-112.5 max-w-[calc(100vw-2rem)] p-1 text-foreground">
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.25fr_1fr]">
				{/* 左侧：站长身份、社交与开源热力图 */}
				<div className="space-y-4">
					{/* 身份头标 */}
					<div className="flex items-center gap-3">
						{avatar ? (
							<img
								src={avatar}
								alt={ownerName}
								className="size-11 rounded-full object-cover ring-1 ring-border/50"
							/>
						) : (
							<span
								aria-hidden="true"
								className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-border/50"
							>
								<svg
									aria-hidden="true"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="size-5"
								>
									<circle
										cx="12"
										cy="12"
										r="3"
										fill="currentColor"
										stroke="none"
									/>
									<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
								</svg>
							</span>
						)}
						<div className="min-w-0">
							<Link
								to="/"
								onClick={onNavigate}
								className="block truncate font-mono text-sm font-bold text-foreground transition-colors hover:text-primary"
							>
								{ownerName}
							</Link>
							{bio ? (
								<p className="truncate text-xs text-muted-foreground">{bio}</p>
							) : null}
						</div>
					</div>

					{/* 社交矩阵与项目直达 */}
					<div className="flex items-center justify-between border-y border-border/40 py-2.5">
						<div className="flex items-center gap-1.5">
							{githubUsername ? (
								<a
									href={`https://github.com/${githubUsername}`}
									target="_blank"
									rel="noreferrer"
									aria-label="GitHub 主页"
									className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
								>
									<GithubIcon className="size-3.5" />
								</a>
							) : null}
							{email ? (
								<a
									href={`mailto:${email}`}
									aria-label="发送邮件"
									className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
								>
									<Mail className="size-3.5" />
								</a>
							) : null}
							<Link
								to="/about"
								onClick={onNavigate}
								aria-label="关于站长"
								className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
							>
								<Sparkles className="size-3.5" />
							</Link>
						</div>

						<Link
							to="/projects"
							onClick={onNavigate}
							className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
						>
							开源项目
							<ArrowUpRight className="size-3" />
						</Link>
					</div>

					{/* 近 3 个月日粒度贡献热力图：复刻原版大图信息架构（头标+图例+月份刻度） */}
					<div>
						{/* 头标：用户名与年度总贡献 + 少→多图例 */}
						<div className="mb-2 flex items-end justify-between gap-3">
							<div className="min-w-0">
								{githubUsername ? (
									<p className="truncate font-mono text-[11px] text-muted-foreground">
										@{githubUsername}
									</p>
								) : null}
								<p className="text-xl font-bold tracking-tight text-foreground">
									{totalContributions.toLocaleString()}
									<span className="ml-1 text-xs font-normal text-muted-foreground">
										次贡献
									</span>
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-1 pb-0.5 font-mono text-[10px] text-muted-foreground/80">
								少
								<span
									aria-hidden="true"
									className="size-2 rounded-[2px] bg-muted"
								/>
								<span
									aria-hidden="true"
									className="size-2 rounded-[2px] bg-primary/30"
								/>
								<span
									aria-hidden="true"
									className="size-2 rounded-[2px] bg-primary/50"
								/>
								<span
									aria-hidden="true"
									className="size-2 rounded-[2px] bg-primary/75"
								/>
								<span
									aria-hidden="true"
									className="size-2 rounded-[2px] bg-primary"
								/>
								多
							</div>
						</div>

						<TooltipProvider>
							<div
								className="flex gap-0.75"
								role="img"
								aria-label="近 3 个月开源贡献热力图"
							>
								{weeks.map((week, wIndex) => (
									<div
										key={week[0]?.key ?? wIndex}
										className="flex min-w-0 flex-1 flex-col gap-0.75"
									>
										{week.map((day) => {
											const isToday = day.key === todayKey;
											return (
												<Tooltip key={day.key}>
													<TooltipTrigger asChild>
														<span
															aria-hidden="true"
															className={cn(
																"aspect-square w-full rounded-[2px] transition-colors hover:ring-1 hover:ring-ring",
																getLevelClass(day.count),
																isToday && "ring-1 ring-primary",
															)}
														/>
													</TooltipTrigger>
													<TooltipContent side="top" sideOffset={4}>
														<p className="font-mono text-[11px]">
															{formatDayTooltip(day.key, day.count)}
														</p>
													</TooltipContent>
												</Tooltip>
											);
										})}
									</div>
								))}
							</div>
						</TooltipProvider>

						{/* 月份刻度行：与热力图列严格等宽对齐 */}
						<div className="mt-1.5 flex gap-0.75" aria-hidden="true">
							{monthTicks.map((tick, i) => (
								<span
									key={i}
									className="min-w-0 flex-1 text-left font-mono text-[9px] leading-none text-muted-foreground/70"
								>
									{tick ?? ""}
								</span>
							))}
						</div>
					</div>
				</div>

				{/* 右侧：时光倒计时与里程碑进度 */}
				<div className="flex flex-col justify-between border-t border-border/40 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
					{/* 上半区：倒计时与独立模块顺排 */}
					<div className="space-y-3.5">
						{/* 倒计时列表 */}
						<div className="space-y-2.5 font-mono">
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">距周末</span>
								<span className="text-sm font-bold text-foreground tabular-nums">
									{daysToWeekend}天
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">距月底</span>
								<span className="text-sm font-bold text-foreground tabular-nums">
									{daysToEndOfMonth}天
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">距年底</span>
								<span className="text-sm font-bold text-foreground tabular-nums">
									{daysToEndOfYear}天
								</span>
							</div>
						</div>

						{/* 独立模块区：抽取为独立组件，支持后续多模块统一配置与渲染 */}
						<HeaderContributionModules onNavigate={onNavigate} />
					</div>
					{/* 进度里程碑 */}
					<div className="mt-4 space-y-3 border-t border-border/40 pt-3">
						<div>
							<div className="mb-1 flex items-center justify-between font-mono text-xs">
								<span className="text-muted-foreground">
									{now.getFullYear()}年进程
								</span>
								<span className="font-semibold text-foreground tabular-nums">
									{yearProgress}%
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
								<div
									className="h-full rounded-full bg-primary transition-all duration-300"
									style={{ width: `${yearProgress}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
