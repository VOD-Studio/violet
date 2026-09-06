import type { SiteSettings } from "@features/settings/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowRight, GitBranch, Mail, Rss, Tv } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
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

/** 首页首屏围绕个人介绍与头像关系组织，不改变站点 Header。 */
export function HomePrelude({ settings, lead, postTotal }: HomePreludeProps) {
	const siteName = settings?.site_name?.trim() || "Violet";
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

	return (
		<section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-18">
			<div
				className={
					avatar
						? "grid items-center gap-14 lg:min-h-96 lg:grid-cols-2 lg:gap-24"
						: "mx-auto flex max-w-2xl justify-center py-12 text-center"
				}
			>
				<div className={avatar ? "max-w-xl" : "max-w-2xl"}>
					<h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
						Hi, I&apos;m <span className="text-primary">{owner}</span>.
					</h1>
					{settings?.profile_role ? (
						<p className="mt-4 text-lg font-medium text-foreground">
							{settings.profile_role}
						</p>
					) : null}
					<p className="mt-6 max-w-[52ch] text-base leading-7 text-muted-foreground sm:text-lg">
						{description}
					</p>

					{socials.length > 0 ? (
						<ul
							className={`mt-9 flex flex-wrap gap-3 ${avatar ? "" : "justify-center"}`}
							aria-label="站点主人的社交链接"
						>
							{socials.map(({ href, label, Icon }) => (
								<li key={label}>
									<a
										href={href}
										target={href.startsWith("http") ? "_blank" : undefined}
										rel={href.startsWith("http") ? "noreferrer" : undefined}
										className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground shadow-sm transition-[border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
									>
										<Icon className="size-4" />
										{label}
									</a>
								</li>
							))}
						</ul>
					) : null}
				</div>

				{avatar ? (
					<motion.figure
						initial={false}
						whileHover={reduceMotion ? undefined : { y: -6, rotate: -1 }}
						transition={{ type: "spring", stiffness: 220, damping: 20, mass: 0.8 }}
						className="flex justify-center lg:justify-end"
					>
						<div className="relative size-56 overflow-hidden rounded-full border border-border bg-muted shadow-xl shadow-black/5 sm:size-64 lg:size-72 dark:shadow-black/20">
							<CroppedImage
								src={avatar}
								width={400}
								fillContainer
								alt={`${owner} 的头像`}
								loading="eager"
								onError={() =>
									setFailedAvatars((current) =>
										current.includes(avatar) ? current : [...current, avatar],
									)
								}
								className="absolute inset-0"
								imgClassName="object-cover grayscale"
							/>
						</div>
					</motion.figure>
				) : null}
			</div>

			<div className="mt-12 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
				{lead ? (
					<HomeContentLink
						item={lead}
						className="group flex min-w-0 items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
					>
						<span className="shrink-0 font-medium text-foreground">最近发布</span>
						<span aria-hidden className="text-border">
							/
						</span>
						<span className="truncate">{lead.title}</span>
						<span className="hidden shrink-0 text-xs tabular-nums md:inline">
							{HOME_KIND_LABEL[lead.kind]} · {formatHomeDate(lead.publishedAt)}
						</span>
						<ArrowRight className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
					</HomeContentLink>
				) : (
					<span className="text-sm text-muted-foreground">公开内容正在整理中。</span>
				)}
				<a
					href="#recent"
					className="group inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
				>
					继续浏览
					<ArrowDown className="size-4 transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none" />
				</a>
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
