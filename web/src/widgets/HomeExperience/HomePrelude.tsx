import type { SiteSettings } from "@features/settings/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { GithubIcon } from "@shared/ui/icons";
import { ImagePixelReveal } from "@shared/ui/image-pixel-reveal";
import { ArrowDown, ArrowRight, Mail, Rss, Tv } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { type ComponentType, type SVGProps, useState } from "react";

import { HomeContentLink } from "./HomeContentLink";
import { formatHomeDate, HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

interface HomePreludeProps {
	settings: SiteSettings | null;
	lead: HomePublicationItem | null;
	postTotal: number;
}

interface SocialLink {
	href: string;
	label: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** 首页序章：保持满屏视口空间，以像素解构动效呈现作者形象，突出保留经典的波浪线问候。 */
export function HomePrelude({ settings, lead, postTotal }: HomePreludeProps) {
	const rawName = settings?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const domain =
		settings?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "xunrua.top";
	const owner = settings?.github_username?.trim() || domain.split(".")[0] || siteName;
	const defaultBio = `这里是 ${siteName}，记录构建、拆解问题与生活思考。收录长文深度思考、技术速查笔记、摄影图集与日常随笔。`;
	const description = settings?.tagline?.trim() || settings?.bio?.trim() || defaultBio;
	const bioSentences = description
		.split(/(?<=[。！？\n])/)
		.map((s) => s.trim())
		.filter(Boolean);
	const leadBio = bioSentences[0] || description;
	const secondaryBio = bioSentences.slice(1).join(" ");
	const socials = buildSocialLinks(settings);
	const avatarCandidates = buildAvatarCandidates(settings, owner);
	const [failedAvatars, setFailedAvatars] = useState<string[]>([]);
	const avatar = avatarCandidates.find((source) => !failedAvatars.includes(source)) || "";

	// 背景大图支持（支持后台配置的 hero_banner_url 或 hero_image）
	const customBanner =
		(settings as Record<string, unknown> | null)?.hero_banner_url ||
		(settings as Record<string, unknown> | null)?.hero_image;
	const hasCustomBanner = typeof customBanner === "string" && customBanner.trim().length > 0;

	return (
		<section
			aria-label="首页序章"
			className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col justify-between overflow-hidden bg-background text-foreground"
		>
			{/* 1. 细腻环境背景层（纯净原生微光，随主题自适应） */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -top-12 z-0 overflow-hidden"
			>
				{hasCustomBanner ? (
					<img
						src={customBanner as string}
						alt=""
						className="size-full object-cover object-center opacity-35 filter dark:opacity-20"
					/>
				) : (
					<div className="relative size-full">
						<div className="absolute top-1/3 left-1/2 h-[460px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[130px] dark:bg-primary/8" />
						<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--color-background)_80%)]" />
					</div>
				)}
			</div>

			{/* 2. 首屏核心展台：满屏视野垂直居中，有机融合头像与个人问候 */}
			<div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-8 sm:px-8 lg:px-12">
				<div
					className={
						avatar
							? "grid w-full items-center gap-10 md:grid-cols-[auto_1fr] md:gap-14 lg:gap-16"
							: "mx-auto flex max-w-2xl flex-col items-center text-center"
					}
				>
					{avatar ? (
						<div className="flex justify-center md:justify-start">
							<figure>
								<div className="size-48 overflow-hidden rounded-xl bg-card sm:size-56 lg:size-60">
									<ImagePixelReveal
										src={avatar}
										alt={`${owner} 的头像`}
										variant="random"
										tileSize={40}
										duration={0.32}
										spreadMs={380}
										replayOnHover
										className="size-full"
										onError={() =>
											setFailedAvatars((current) =>
												current.includes(avatar)
													? current
													: [...current, avatar],
											)
										}
									/>
								</div>
							</figure>
						</div>
					) : null}

					{/* 核心问候与自白区域 */}
					<div
						className={
							avatar
								? "max-w-xl space-y-6 text-left"
								: "max-w-2xl space-y-6 text-center"
						}
					>
						{/* 问候主标题：严格保留 Hi, I'm xunrua. 标志性红色波浪线 */}
						<h1 className="text-4xl font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
							Hi, I&apos;m{" "}
							<span className="font-medium text-primary underline decoration-primary/35 decoration-wavy underline-offset-8 sm:underline-offset-10">
								{owner}
							</span>
							.
						</h1>

						{/* Editorial 典雅引言 */}
						<blockquote className="relative">
							<span
								aria-hidden="true"
								className="pointer-events-none select-none font-serif text-4xl leading-none text-primary/25 sm:text-5xl -mb-2.5 block"
							>
								“
							</span>
							<div className="space-y-2">
								<p className="font-serif text-base leading-relaxed text-foreground/90 sm:text-lg">
									{leadBio}
								</p>
								{secondaryBio ? (
									<p className="font-serif text-sm leading-relaxed text-muted-foreground/75 sm:text-base">
										{secondaryBio}
									</p>
								) : null}
							</div>
						</blockquote>

						{/* 创作足迹微指标 */}
						<div
							className={`flex flex-wrap items-center gap-2.5 font-mono text-xs text-muted-foreground/80 ${
								avatar ? "" : "justify-center"
							}`}
						>
							{postTotal > 0 ? (
								<div className="inline-flex items-baseline gap-1.5">
									<span className="text-sm font-semibold tabular-nums text-foreground">
										{postTotal}
									</span>
									<span>篇深度笔墨</span>
								</div>
							) : null}
							{postTotal > 0 ? (
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
							) : null}
							<span>开源探索</span>
							{settings?.profile_location ? (
								<>
									<span aria-hidden className="text-muted-foreground/40">
										·
									</span>
									<span>{settings.profile_location}</span>
								</>
							) : null}
						</div>

						{/* 社交矩阵：纯图标轻量导航条 + 悬停圆底与下方纯净卡片气泡 */}
						{socials.length > 0 ? (
							<TooltipPrimitive.Provider delayDuration={100}>
								<nav
									className={`flex items-center gap-2 pt-2 ${avatar ? "" : "justify-center"}`}
									aria-label="社交主页链接"
								>
									{socials.map(({ href, label, Icon }) => (
										<TooltipPrimitive.Root key={label}>
											<TooltipPrimitive.Trigger asChild>
												<a
													href={href}
													target={
														href.startsWith("http")
															? "_blank"
															: undefined
													}
													rel={
														href.startsWith("http")
															? "noreferrer"
															: undefined
													}
													aria-label={label}
													className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground/75 transition-colors duration-200 outline-none hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
												>
													<Icon className="size-5 transition-colors duration-200" />
												</a>
											</TooltipPrimitive.Trigger>
											<TooltipPrimitive.Portal>
												<TooltipPrimitive.Content
													side="bottom"
													sideOffset={8}
													className="z-50 rounded-lg border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-sm animate-in fade-in-0 data-[side=bottom]:slide-in-from-top-1"
												>
													{label}
												</TooltipPrimitive.Content>
											</TooltipPrimitive.Portal>
										</TooltipPrimitive.Root>
									))}
								</nav>
							</TooltipPrimitive.Provider>
						) : null}
					</div>
				</div>
			</div>

			{/* 3. 首屏底部锚定条：随满屏视口底部舒展，提供清晰的最新动态与向下阅读线索 */}
			<div className="relative z-10 border-t border-border/40 bg-background/50 backdrop-blur-md">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 text-xs text-muted-foreground sm:px-8 lg:px-12">
					{lead ? (
						<HomeContentLink
							item={lead}
							className="group flex min-w-0 items-center gap-2.5 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<span className="size-1.5 rounded-full bg-primary" />
							<span className="font-medium text-foreground">最新发布</span>
							<span aria-hidden className="text-border">
								/
							</span>
							<span className="truncate max-w-xs sm:max-w-md lg:max-w-lg">
								{lead.title}
							</span>
							<span className="hidden shrink-0 tabular-nums text-muted-foreground/70 md:inline">
								{HOME_KIND_LABEL[lead.kind]} · {formatHomeDate(lead.publishedAt)}
							</span>
							<ArrowRight className="size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
						</HomeContentLink>
					) : (
						<span className="text-muted-foreground">公开内容正在整理中。</span>
					)}

					<a
						href="#recent"
						className="group inline-flex shrink-0 items-center gap-1.5 pl-4 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						<span>浏览笔墨</span>
						<ArrowDown className="size-3.5 transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none" />
					</a>
				</div>
			</div>
		</section>
	);
}

function buildAvatarCandidates(settings: SiteSettings | null, owner: string): string[] {
	const configuredAvatar = settings?.avatar_url?.trim();
	const githubAvatar = settings?.github_username
		? `https://github.com/${encodeURIComponent(settings.github_username)}.png?size=400`
		: "";
	return [
		...new Set([configuredAvatar ? avatarUrl(configuredAvatar, owner) : "", githubAvatar]),
	].filter(Boolean);
}

function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

function buildSocialLinks(settings: SiteSettings | null): SocialLink[] {
	const links: SocialLink[] = [];
	if (settings?.social_twitter) {
		links.push({
			href: settings.social_twitter.startsWith("http")
				? settings.social_twitter
				: `https://x.com/${settings.social_twitter.replace(/^@/, "")}`,
			label: "X",
			Icon: XIcon,
		});
	}
	const rssUrl = settings?.social_rss?.trim() || "/feed.xml";
	links.push({
		href: rssUrl,
		label: "RSS",
		Icon: Rss,
	});
	if (settings?.social_email) {
		links.push({
			href: settings.social_email.startsWith("mailto:")
				? settings.social_email
				: `mailto:${settings.social_email}`,
			label: "邮件",
			Icon: Mail,
		});
	}
	if (settings?.github_username) {
		links.push({
			href: `https://github.com/${settings.github_username}`,
			label: "GitHub",
			Icon: GithubIcon,
		});
	}
	if (settings?.social_bilibili) {
		links.push({
			href: settings.social_bilibili,
			label: "哔哩哔哩",
			Icon: Tv,
		});
	}
	return links;
}
