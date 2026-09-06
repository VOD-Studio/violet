import type { SiteSettings } from "@features/settings/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowRight, GitBranch, Mail, Rss, Tv } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";

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
	Icon: LucideIcon;
}

/** 首页沉浸式首屏：占满视口，支持自定义背景图与景深视差滚动。 */
export function HomePrelude({ settings, lead, postTotal }: HomePreludeProps) {
	const rawName = settings?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const domain =
		settings?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "xunrua.top";
	const owner = settings?.github_username?.trim() || domain.split(".")[0] || siteName;
	const description =
		settings?.tagline?.trim() ||
		settings?.bio?.trim() ||
		`这里是 ${siteName}，收录文章、笔记、图集与推文${postTotal > 0 ? `，目前有 ${postTotal} 篇文章` : ""}。`;
	const socials = buildSocialLinks(settings);
	const avatarCandidates = buildAvatarCandidates(settings, owner);
	const [failedAvatars, setFailedAvatars] = useState<string[]>([]);
	const avatar = avatarCandidates.find((source) => !failedAvatars.includes(source)) || "";
	const reduceMotion = useReducedMotion();

	// 视差滚动容器与位移映射
	const sectionRef = useRef<HTMLElement>(null);
	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ["start start", "end start"],
	});

	// 背景层视差：随滚动轻微下移并微放，营造真实纵深景深
	const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const backgroundScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);
	// 立体头像轻微反向浮动位移
	const avatarY = useTransform(scrollYProgress, [0, 1], [0, -32]);

	// 背景大图支持（支持未来配置的 hero_banner_url 或 hero_image）
	const customBanner =
		(settings as Record<string, unknown> | null)?.hero_banner_url ||
		(settings as Record<string, unknown> | null)?.hero_image;
	const hasCustomBanner = typeof customBanner === "string" && customBanner.trim().length > 0;

	return (
		<section
			ref={sectionRef}
			aria-label="首页序章"
			className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col justify-between overflow-hidden bg-background text-foreground"
		>
			{/* 1. 视差背景层（支持自定义大图，无图时展示纯净通透的环境微光） */}
			<motion.div
				aria-hidden
				style={reduceMotion ? undefined : { y: backgroundY, scale: backgroundScale }}
				className="pointer-events-none absolute inset-0 -top-8 z-0 overflow-hidden"
			>
				{hasCustomBanner ? (
					<img
						src={customBanner as string}
						alt=""
						className="size-full object-cover object-center opacity-40 filter dark:opacity-25"
					/>
				) : (
					/* 纯净 Violet 原生微光几何氛围层（无外部脏混色，通透呼吸） */
					<div className="relative size-full">
						<div className="absolute top-1/4 left-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[120px] dark:bg-primary/8" />
						<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,var(--color-background)_80%)]" />
					</div>
				)}

				{/* 底部超宽羽化渐变遮罩：无论背景为何，均与下方主内容平滑消融 */}
				<div className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-b from-transparent via-background/60 to-background" />
			</motion.div>

			{/* 2. 首屏核心内容区（垂直居中舒展排布） */}
			<div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-12 sm:px-8 lg:px-12">
				<div
					className={
						avatar
							? "grid w-full items-center gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16"
							: "mx-auto flex max-w-2xl flex-col items-center py-12 text-center"
					}
				>
					{/* 左侧：舒展个人宣言 */}
					<div
						className={
							avatar ? "max-w-2xl space-y-6" : "max-w-2xl space-y-6 text-center"
						}
					>
						{/* 角色与状态微标 */}
						<div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3.5 py-1 text-xs text-muted-foreground/90 backdrop-blur-md">
							<span className="relative flex size-2 items-center justify-center">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/50 opacity-75" />
								<span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
							</span>
							<span>{settings?.profile_role || "全栈开发 · 自由创作"}</span>
						</div>

						{/* 问候主标题 */}
						<h1 className="text-4xl font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.5rem]">
							Hi, I&apos;m{" "}
							<span className="font-medium text-primary underline decoration-primary/20 decoration-wavy underline-offset-8">
								{owner}
							</span>
							.
						</h1>

						{/* 真实自白 */}
						<p className="max-w-xl text-base leading-relaxed text-muted-foreground/85 font-serif sm:text-lg">
							{description}
						</p>

						{/* 创作足迹微指标 */}
						<div
							className={`flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-muted-foreground/75 ${
								avatar ? "" : "justify-center"
							}`}
						>
							<div className="inline-flex items-baseline gap-1.5">
								<span className="text-sm font-semibold text-foreground tabular-nums">
									{postTotal}
								</span>
								<span>篇深度创作</span>
							</div>
							<span aria-hidden className="text-border">
								/
							</span>
							<span>开源爱好者</span>
							{settings?.profile_location ? (
								<>
									<span aria-hidden className="text-border">
										/
									</span>
									<span>{settings.profile_location}</span>
								</>
							) : null}
						</div>

						{/* 社交矩阵 */}
						{socials.length > 0 ? (
							<ul
								className={`flex flex-wrap gap-2.5 pt-2 ${avatar ? "" : "justify-center"}`}
								aria-label="社交主页链接"
							>
								{socials.map(({ href, label, Icon }) => (
									<li key={label}>
										<a
											href={href}
											target={href.startsWith("http") ? "_blank" : undefined}
											rel={href.startsWith("http") ? "noreferrer" : undefined}
											className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
										>
											<Icon className="size-3.5" />
											{label}
										</a>
									</li>
								))}
							</ul>
						) : null}
					</div>

					{/* 右侧：立体悬浮形象（大圆角框体与呼吸光圈） */}
					{avatar ? (
						<div className="flex justify-center lg:justify-end">
							<motion.figure
								style={reduceMotion ? undefined : { y: avatarY }}
								whileHover={
									reduceMotion ? undefined : { scale: 1.02, rotate: -0.5 }
								}
								transition={{ type: "spring", stiffness: 220, damping: 20 }}
								className="group relative"
							>
								{/* 微光底晕 */}
								<div className="absolute -inset-4 rounded-[2rem] bg-linear-to-tr from-primary/10 via-transparent to-primary/5 blur-xl opacity-70 transition-opacity duration-300 group-hover:opacity-100" />

								{/* 立体大圆角框体 */}
								<div className="relative size-56 overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-[0_24px_50px_-15px_rgba(0,0,0,0.08)] backdrop-blur-md sm:size-64 lg:size-72 dark:shadow-[0_24px_50px_-15px_rgba(0,0,0,0.5)]">
									<CroppedImage
										src={avatar}
										width={400}
										fillContainer
										alt={`${owner} 的头像`}
										loading="eager"
										onError={() =>
											setFailedAvatars((current) =>
												current.includes(avatar)
													? current
													: [...current, avatar],
											)
										}
										className="absolute inset-0"
										imgClassName="object-cover grayscale transition-transform duration-500 group-hover:scale-105"
									/>
								</div>
							</motion.figure>
						</div>
					) : null}
				</div>
			</div>

			{/* 3. 首屏底部锚定条（最新发布 + 向下漫游平滑导流） */}
			<div className="relative z-10 border-t border-border/35 bg-background/60 backdrop-blur-md">
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
						<span>浏览内容</span>
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

function buildSocialLinks(settings: SiteSettings | null): SocialLink[] {
	const links: SocialLink[] = [];
	if (settings?.github_username) {
		links.push({
			href: `https://github.com/${settings.github_username}`,
			label: "GitHub",
			Icon: GitBranch,
		});
	}
	if (settings?.social_email) {
		links.push({
			href: settings.social_email.startsWith("mailto:")
				? settings.social_email
				: `mailto:${settings.social_email}`,
			label: "邮件",
			Icon: Mail,
		});
	}
	if (settings?.social_rss) links.push({ href: settings.social_rss, label: "RSS", Icon: Rss });
	if (settings?.social_bilibili) {
		links.push({ href: settings.social_bilibili, label: "哔哩哔哩", Icon: Tv });
	}
	return links;
}
