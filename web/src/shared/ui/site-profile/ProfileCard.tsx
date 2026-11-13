import { Avatar, GithubIcon, iconProps } from "@violet/ui";
import { cn } from "cn";
import { AppWindow, BookOpen, Laptop, Link2, Music, Rss, User } from "lucide-react";
import type { ReactNode } from "react";
import { type NavbarLinkComponent, RouterLink } from "../site-navbar";

export interface ProfileLatest {
	title: string;
	/** 已格式化，如 "10.10"。 */
	date: string;
	href: string;
}

export interface ProfileNowMedia {
	/** 如「正在播放 · 网易云音乐」「已暂停 · QQ 音乐」。 */
	sourceLabel: string;
	title: string;
	/** 如「周杰伦 · 叶惠美」，可空。 */
	subtitle?: string;
	cover?: string | null;
	paused?: boolean;
	/** 进度行（时间、轨道、总时长）；调用方按需注入，省略则不显示。 */
	progress?: ReactNode;
}

export interface ProfileNowApp {
	name: string;
	/** 窗口标题，可空。 */
	detail?: string;
	icon?: string | null;
	/** 本次使用时长，如「1 时 20 分」；省略则这一段不渲染。 */
	usage?: string;
}

export interface ProfileNow {
	/** 设备名，如「MacBook Pro」。 */
	deviceName: string;
	media?: ProfileNowMedia;
	app?: ProfileNowApp;
}

export interface ProfileIdentity {
	name: string;
	bio?: string;
	avatar?: string | null;
	/** 省略则不渲染 GitHub 按钮。 */
	githubHref?: string;
	/** 省略则不渲染 RSS 按钮。 */
	rssHref?: string;
}

export interface ProfileYear {
	year: number;
	/** 第几天，1 起。 */
	dayOfYear: number;
	daysLeft: number;
	/** 当前月 0–11。 */
	month: number;
}

export interface ProfileCardProps {
	identity: ProfileIdentity;
	/** 省略或没有 media 也没有 app 时，整块「此刻」（含标题行）不出现。 */
	now?: ProfileNow;
	/** 两条都省略且都不在加载时整行不出现；只有一条时它独占一行。 */
	latest?: { post?: ProfileLatest; note?: ProfileLatest };
	/**
	 * 哪几条还在取：没有值又在加载的那条先占一块同尺寸的位置，文章在前、手记在后。
	 * 版式按「就绪 + 加载中」的条数定列，先到后到都不会让一列变两列。
	 */
	latestPending?: { post?: boolean; note?: boolean };
	year: ProfileYear;
	/** 点击站内链接后回调，站点里据此收起卡片。 */
	onNavigate?: () => void;
	/** 站内链接的渲染组件，默认走路由跳转。 */
	LinkComponent?: NavbarLinkComponent;
	className?: string;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const EXTERNAL = {
	target: "_blank",
	rel: "noopener noreferrer",
} as const;
const ENTRIES = [
	{ href: "/about", label: "关于我", Icon: BookOpen },
	{ href: "/persona", label: "人设", Icon: User },
	{ href: "/friends", label: "友链", Icon: Link2 },
] as const;

/** 圆形图片槽：有图显示图，没有就是同尺寸的占位，数据到达不挪动周围的版面。 */
function Disc({
	slot,
	src,
	fallback,
	className,
}: {
	slot: string;
	src?: string | null;
	fallback: ReactNode;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			data-slot={slot}
			className={cn(
				"flex flex-none items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
				className,
			)}
		>
			{src ? <img src={src} alt="" className="size-full object-cover" /> : fallback}
		</span>
	);
}

function CircleLink({
	label,
	href,
	children,
}: {
	label: string;
	href: string;
	children: ReactNode;
}) {
	return (
		<a
			aria-label={label}
			href={href}
			{...EXTERNAL}
			className={cn(
				"flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70",
				FOCUS,
			)}
		>
			{children}
		</a>
	);
}

function MediaRow({ media }: { media: ProfileNowMedia }) {
	return (
		<div className="mt-3 flex items-center gap-3.5">
			<span className="relative size-14 flex-none">
				<Disc
					slot="profile-cover"
					src={media.cover}
					fallback={<Music aria-hidden="true" className="size-5" />}
					className={cn("size-full", media.paused && "grayscale opacity-60")}
				/>
				<span
					aria-hidden="true"
					className="absolute -right-0.75 -bottom-0.75 flex size-5.5 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"
				>
					<Music {...iconProps(12)} />
				</span>
			</span>
			<div className="min-w-0 flex-1">
				<div className="truncate text-xs text-muted-foreground">{media.sourceLabel}</div>
				<div className="truncate text-[15px] font-medium">{media.title}</div>
				{media.subtitle ? (
					<div className="truncate text-[12.5px] text-muted-foreground">
						{media.subtitle}
					</div>
				) : null}
				{media.progress ? <div className="mt-1.5">{media.progress}</div> : null}
			</div>
		</div>
	);
}

function AppRow({ app }: { app: ProfileNowApp }) {
	return (
		<div className="mt-3.5 flex items-center gap-3.5">
			<Disc
				slot="profile-app"
				src={app.icon}
				fallback={<AppWindow aria-hidden="true" className="size-4" />}
				className="mx-2 size-10"
			/>
			<div className="min-w-0 flex-1">
				<div className="text-xs text-muted-foreground">正在使用</div>
				<div className="truncate text-sm font-medium">
					{app.name}
					{app.detail ? (
						<span className="text-[12.5px] font-normal text-muted-foreground">
							{" "}
							{app.detail}
						</span>
					) : null}
				</div>
			</div>
			{app.usage ? (
				<span className="flex-none text-xs text-muted-foreground">{app.usage}</span>
			) : null}
		</div>
	);
}

/** 年度进度条的一格：已过的月份是季节色混凹陷色，当前月是季节色，之后是凹陷色。 */
function monthTone(month: number, current: number): string {
	if (month < current) return "bg-[color-mix(in_oklab,var(--decoration)_55%,var(--muted))]";
	return month === current ? "bg-decoration" : "bg-muted";
}

/**
 * 站长卡片的内容：身份、此刻（听的歌与用的应用）、最新文章与手记、年度进度、入口三链。
 *
 * 不含面板外壳，由 {@link SiteProfile} 放进变形面板。纯展示：时间相关文案与进度都由调用方给出。
 */
export function ProfileCard({
	identity,
	now,
	latest,
	latestPending,
	year,
	onNavigate,
	LinkComponent = RouterLink,
	className,
}: ProfileCardProps) {
	const showNow = now !== undefined && (now.media !== undefined || now.app !== undefined);
	const slots = [
		{ label: "新文章", item: latest?.post, pending: latestPending?.post === true },
		{ label: "新手记", item: latest?.note, pending: latestPending?.note === true },
	].filter((slot) => slot.item !== undefined || slot.pending);

	return (
		<div className={cn("p-4.5 text-[13px]/[1.5] text-foreground", className)}>
			<div className="flex items-center gap-3.5">
				<Avatar
					data-slot="profile-avatar"
					src={identity.avatar ?? undefined}
					name={identity.name}
					alt=""
					size={48}
					className="size-13 shrink-0"
				/>
				<div className="min-w-0 flex-1">
					<div className="truncate text-base font-bold">{identity.name}</div>
					{identity.bio ? (
						<div className="truncate text-[12.5px] text-muted-foreground">
							{identity.bio}
						</div>
					) : null}
				</div>
				<span className="flex gap-1.5">
					{identity.githubHref ? (
						<CircleLink label="GitHub" href={identity.githubHref}>
							<GithubIcon className="size-3.75" />
						</CircleLink>
					) : null}
					{identity.rssHref ? (
						<CircleLink label="RSS" href={identity.rssHref}>
							<Rss aria-hidden="true" className="size-4" />
						</CircleLink>
					) : null}
				</span>
			</div>

			{showNow ? (
				<section aria-label="此刻" className="mt-5">
					<div className="flex items-center justify-between">
						<span className="text-[12.5px] font-semibold">此刻</span>
						<span className="flex items-center gap-1 text-xs text-muted-foreground">
							<Laptop aria-hidden="true" {...iconProps(14)} />
							{now.deviceName}
						</span>
					</div>
					{now.media ? <MediaRow media={now.media} /> : null}
					{now.app ? <AppRow app={now.app} /> : null}
				</section>
			) : null}

			{slots.length > 0 ? (
				<div
					data-slot="profile-latest"
					className={cn(
						"mt-4.5 grid gap-2",
						slots.length === 1 ? "grid-cols-1" : "grid-cols-2",
					)}
				>
					{slots.map(({ label, item }) =>
						item ? (
							<LinkComponent
								key={label}
								href={item.href}
								onClick={onNavigate}
								className={cn(
									"block min-h-22 rounded-xl bg-muted p-3 transition-colors hover:bg-muted/70",
									FOCUS,
								)}
							>
								<span className="flex justify-between text-[11.5px] text-muted-foreground">
									<span>{label}</span>
									<span>{item.date}</span>
								</span>
								<span className="mt-1.5 line-clamp-2 block text-[13.5px]/[1.45] font-medium">
									{item.title}
								</span>
							</LinkComponent>
						) : (
							<span
								key={label}
								aria-hidden="true"
								data-slot="profile-latest-pending"
								className="block min-h-22 rounded-xl bg-muted"
							/>
						),
					)}
				</div>
			) : null}

			<div className="mt-4">
				<div className="flex justify-between text-xs text-muted-foreground tabular-nums">
					<span>
						{year.year} · 第 {year.dayOfYear} 天
					</span>
					<span>还有 {year.daysLeft} 天</span>
				</div>
				<div
					aria-hidden="true"
					data-slot="profile-months"
					className="mt-2 grid grid-cols-12 gap-0.75"
				>
					{Array.from({ length: 12 }, (_, month) => (
						<span
							key={month}
							className={cn("h-1.5 rounded-xs", monthTone(month, year.month))}
						/>
					))}
				</div>
			</div>

			<div className="mt-4 grid grid-cols-3 border-t border-border pt-3 text-center text-[13px]">
				{ENTRIES.map(({ href, label, Icon }) => (
					<LinkComponent
						key={href}
						href={href}
						onClick={onNavigate}
						className={cn(
							"flex items-center justify-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground",
							FOCUS,
						)}
					>
						<Icon aria-hidden="true" {...iconProps(14)} />
						{label}
					</LinkComponent>
				))}
			</div>
		</div>
	);
}
