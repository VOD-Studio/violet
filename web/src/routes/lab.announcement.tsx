import type { Announcement } from "@features/settings/model/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import AnimatedList from "@vendor/react-bits/AnimatedList";
import BlurText from "@vendor/react-bits/BlurText";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import Magnet from "@vendor/react-bits/Magnet";
import { CubeFlipY, FlipX } from "@widgets/AnnouncementLab";
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/* mock 数据（真实运营文案，覆盖 4 种 severity）                       */
/* ------------------------------------------------------------------ */

const MOCK: Announcement[] = [
	{
		id: 1,
		title: "v2.0 版本发布说明",
		content: "本次更新重构了评论系统，新增 Markdown 实时预览，并修复了若干体验问题。",
		severity: "success",
		display: "article",
		is_active: true,
		excerpt: "评论系统重构完成，新增 Markdown 实时预览。",
		affects: ["posts", "comments"],
		created_at: "2026-07-03T14:22:00+08:00",
	} as Announcement,
	{
		id: 2,
		title: "周六数据库维护",
		content: "02:00-04:00 暂停服务，请提前保存草稿。维护期间访问将自动重定向到维护页。",
		severity: "warning",
		display: "article",
		is_active: true,
		excerpt: "02:00-04:00 暂停服务，请提前保存草稿。",
		affects: ["site"],
		created_at: "2026-07-03T10:15:00+08:00",
	} as Announcement,
	{
		id: 3,
		title: "评论鉴权异常已修复",
		content: "GitHub OAuth 回调 URL 已修正，登录恢复正常。",
		severity: "info",
		display: "card",
		is_active: true,
		excerpt: "GitHub OAuth 回调 URL 已修正。",
		affects: ["comments", "auth"],
		created_at: "2026-07-02T22:40:00+08:00",
	} as Announcement,
	{
		id: 4,
		title: "图片服务降级",
		content: "CDN 节点故障，图片加载可能延迟，正在抢修。",
		severity: "error",
		display: "card",
		is_active: true,
		excerpt: "CDN 节点故障，图片加载可能延迟。",
		affects: ["media"],
		created_at: "2026-07-02T18:03:00+08:00",
	} as Announcement,
];

/* ------------------------------------------------------------------ */
/* severity → 中性色映射（去 neon，用 shadcn 友好的色阶）               */
/* ------------------------------------------------------------------ */

interface SevCfg {
	/** 徽章背景 + 文字（药丸） */
	badge: string;
	/** 圆点色 */
	dot: string;
	/** BorderGlow 配色（HSL 三元组字符串，组件要 HSL） */
	glow: [string, string, string];
	/** lucide 图标 */
	Icon: ComponentType<{ className?: string }>;
	label: string;
}

const SEV: Record<string, SevCfg> = {
	info: {
		badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
		dot: "bg-blue-500",
		glow: ["217 91 60", "217 91 60", "217 91 60"],
		Icon: Info,
		label: "信息",
	},
	warning: {
		badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
		dot: "bg-amber-500",
		glow: ["38 92 50", "38 92 50", "38 92 50"],
		Icon: TriangleAlert,
		label: "警告",
	},
	success: {
		badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
		dot: "bg-emerald-500",
		glow: ["152 76 40", "152 76 40", "152 76 40"],
		Icon: CircleCheck,
		label: "成功",
	},
	error: {
		badge: "bg-red-500/10 text-red-600 dark:text-red-400",
		dot: "bg-red-500",
		glow: ["0 84 60", "0 84 60", "0 84 60"],
		Icon: CircleX,
		label: "错误",
	},
};

function stamp(iso: string) {
	return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

/* ------------------------------------------------------------------ */
/* 方案 A：BorderGlow 柔光卡片                                          */
/* ------------------------------------------------------------------ */

function GlowCard({ a }: { a: Announcement }) {
	const cfg = SEV[a.severity] ?? SEV.info;
	return (
		<BorderGlow
			backgroundColor="hsl(var(--card))"
			borderRadius={16}
			glowColor={cfg.glow[0]}
			colors={[
				`hsl(${cfg.glow[0]} / 0.9)`,
				`hsl(${cfg.glow[1]} / 0.6)`,
				`hsl(${cfg.glow[2]} / 0.9)`,
			]}
			glowIntensity={0.6}
			glowRadius={20}
			animated={false}
			className="min-h-55"
		>
			<div className="flex flex-col gap-3 p-6">
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>{stamp(a.created_at)}</span>
					<span className="font-mono tabular-nums">#{String(a.id).padStart(3, "0")}</span>
				</div>

				<BlurText
					text={a.title}
					animateBy="words"
					stepDuration={0.4}
					delay={80}
					className="text-lg font-semibold leading-snug text-foreground"
				/>

				<p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>

				{a.affects?.length ? (
					<div className="flex flex-wrap gap-1">
						{a.affects.slice(0, 4).map((m) => (
							<span
								key={m}
								className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
							>
								{m}
							</span>
						))}
					</div>
				) : null}

				<div className="mt-auto flex items-center justify-end border-t border-edge-hairline pt-3 text-xs">
					<Link
						to="/announcements/$id"
						params={{ id: String(a.id) }}
						className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:opacity-70"
					>
						阅读 <ArrowRight className="size-3" />
					</Link>
				</div>
			</div>
		</BorderGlow>
	);
}

/* ------------------------------------------------------------------ */
/* 方案 B：极简描边卡片（无炫光，仅 Magnet 磁吸按钮）                    */
/* ------------------------------------------------------------------ */

function MinimalCard({ a }: { a: Announcement }) {
	const cfg = SEV[a.severity] ?? SEV.info;
	return (
		<div className="group flex min-h-55 flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
			<div className="mb-3 flex items-center justify-between">
				<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
					<span className={`size-1.5 rounded-full ${cfg.dot}`} />
					{cfg.label}
				</span>
				<span className="font-mono text-xs text-muted-foreground">
					EVENT #{String(a.id).padStart(3, "0")}
				</span>
			</div>

			<h3 className="mb-2 text-lg font-semibold leading-snug text-foreground">{a.title}</h3>
			<p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>

			{a.affects?.length ? (
				<div className="mb-4 flex flex-wrap gap-1">
					{a.affects.slice(0, 4).map((m) => (
						<span
							key={m}
							className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
						>
							{m}
						</span>
					))}
				</div>
			) : null}

			<div className="mt-auto flex items-center justify-between border-t border-edge-hairline pt-3">
				<span className="text-xs text-muted-foreground">{stamp(a.created_at)}</span>
				<Magnet magnetStrength={3} padding={20}>
					<Link
						to="/announcements/$id"
						params={{ id: String(a.id) }}
						className="inline-flex items-center gap-1 text-xs font-medium text-foreground transition-opacity hover:opacity-70"
					>
						阅读 <ArrowRight className="size-3" />
					</Link>
				</Magnet>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* 详情页预览：AnimatedList 时间轴                                      */
/* ------------------------------------------------------------------ */

function ArticlePreview({ a }: { a: Announcement }) {
	const cfg = SEV[a.severity] ?? SEV.info;
	const [selected, setSelected] = useState(0);
	const timeline = [
		`[${new Date(a.created_at).toISOString().slice(0, 16)}] 事件开启`,
		`[${new Date(a.created_at).toISOString().slice(0, 16)}] 推送到首页卡片`,
		...(a.start_time
			? [`[${new Date(a.start_time).toISOString().slice(0, 16)}] 生效窗口开始`]
			: []),
		...(a.end_time
			? [`[${new Date(a.end_time).toISOString().slice(0, 16)}] 生效窗口结束`]
			: []),
		`[now] 状态：${a.is_active === false ? "INACTIVE" : "ACTIVE"}`,
	];

	return (
		<div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8">
			<Link
				to="/"
				className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				返回
			</Link>

			<header className="mb-6 border-b border-edge-hairline pb-4">
				<div className="mb-3 flex items-center justify-end">
					<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span className={`size-1.5 animate-pulse rounded-full ${cfg.dot}`} />
						{a.is_active === false ? "已失效" : "生效中"}
					</span>
				</div>
				<BlurText
					text={a.title}
					animateBy="words"
					stepDuration={0.4}
					delay={60}
					className="text-2xl font-bold leading-tight text-foreground"
				/>
			</header>

			<div className="mb-6">
				<div className="mb-2 text-xs text-muted-foreground">事件时间轴</div>
				<AnimatedList
					items={timeline}
					initialSelectedIndex={0}
					onItemSelect={(_, i) => setSelected(i)}
					showGradients={false}
					displayScrollbar={false}
					className="w-full!"
					itemClassName="bg-transparent! p-2! mb-1!"
				/>
				<p className="mt-2 text-xs text-muted-foreground">
					当前选中：第 {selected + 1} 条 / 共 {timeline.length} 条
				</p>
			</div>

			<div className="mb-6">
				<div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
					正文
				</div>
				<p className="text-sm leading-relaxed text-foreground">{a.content}</p>
			</div>

			<footer className="flex items-center gap-3 border-t border-edge-hairline pt-4 text-xs">
				<Magnet magnetStrength={4} padding={30}>
					<button
						type="button"
						className="rounded-full border border-border px-4 py-1.5 transition-colors hover:bg-muted"
					>
						✓ 确认已读
					</button>
				</Magnet>
				<button
					type="button"
					className="rounded-full border border-border px-4 py-1.5 transition-colors hover:bg-muted"
				>
					复制事件 ID
				</button>
				<Link
					to="/"
					className="ml-auto rounded-full border border-border px-4 py-1.5 transition-colors hover:bg-muted"
				>
					← 返回
				</Link>
			</footer>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* lab 页面                                                            */
/* ------------------------------------------------------------------ */

function AnnouncementLab() {
	const bannerCards = [
		{ title: "1. 3D 翻转 (X 轴)", description: "FlipX", component: FlipX },
		{ title: "2. 立方翻转 (Y 轴)", description: "CubeFlipY", component: CubeFlipY },
	];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<Link
					to="/lab"
					className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" />
					Labs
				</Link>
				<h1 className="mb-4 text-4xl font-bold tracking-tight">公告原型实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					卡片 / 详情页原型对比（中性方向，基于 react-bits 组件）。下方为历史 banner
					原型，保留作参考。
				</p>
			</div>

			{/* ============ 新：卡片方案对比 ============ */}
			<section className="mb-24">
				<h2 className="mb-2 text-2xl font-semibold">卡片方案</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					左：BorderGlow 柔光渐变边框 + BlurText 标题，severity 仅由边框色相表达。
					右：极简描边 + Magnet 磁吸按钮。
				</p>
				<div className="grid gap-6 lg:grid-cols-2">
					<div className="flex flex-col gap-4">
						<span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
							方案 A · BorderGlow 柔光
						</span>
						<GlowCard a={MOCK[0]} />
						<GlowCard a={MOCK[1]} />
					</div>
					<div className="flex flex-col gap-4">
						<span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
							方案 B · 极简描边
						</span>
						<MinimalCard a={MOCK[2]} />
						<MinimalCard a={MOCK[3]} />
					</div>
				</div>
			</section>

			{/* ============ 新：详情页预览 ============ */}
			<section className="mb-24">
				<h2 className="mb-2 text-2xl font-semibold">详情页预览</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					时间轴用 AnimatedList（可点击/键盘上下选择），标题用 BlurText 渐显， 按钮用
					Magnet 磁吸。
				</p>
				<ArticlePreview a={MOCK[0]} />
			</section>

			{/* ============ 旧：banner 原型（保留） ============ */}
			<section>
				<h2 className="mb-2 text-2xl font-semibold">历史 Banner 原型</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					这些是顶部多面体公告条的早期创意，hover 可暂停，滚轮可手动翻阅。
				</p>
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					{bannerCards.map((card) => {
						const Component = card.component;
						return (
							<div
								key={card.title}
								className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 shadow-sm"
							>
								<h3 className="mb-1 text-lg font-semibold">{card.title}</h3>
								<p className="mb-8 text-sm text-muted-foreground">
									{card.description}
								</p>
								<div className="flex h-56 w-full items-center justify-center rounded-xl bg-muted/50">
									<Component />
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/announcement")({
	component: AnnouncementLab,
});
