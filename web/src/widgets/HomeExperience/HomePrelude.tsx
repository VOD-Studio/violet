import { formatDate } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { Epigraph } from "@shared/ui/epigraph";
import { GithubIcon } from "@shared/ui/icons";
import { ImagePixelReveal } from "@shared/ui/image-pixel-reveal";
import { ArrowDown, ArrowRight, ExternalLink, Mail, Rss, Share2, Tv } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { type ComponentType, type SVGProps, useState } from "react";

import { HomeContentLink } from "./HomeContentLink";
import { HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem, SiteIdentity } from "./types";

interface HomePreludeProps {
	identity: SiteIdentity;
	lead: HomePublicationItem | null;
}

interface SocialLink {
	href: string;
	label: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const SOCIAL_ICON_BY_KIND: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	github: GithubIcon,
	twitter: XIcon,
	mastodon: Share2,
	email: Mail,
	bilibili: Tv,
	rss: Rss,
};

/** 首页序章：展示服务端归一后的站点身份与最新发布。 */
export function HomePrelude({ identity, lead }: HomePreludeProps) {
	const siteName = identity.site_name;
	const owner = identity.owner_name;
	const socialLinks = identity.social_links.map<SocialLink>((link) => ({
		href: link.href,
		label: link.label,
		Icon: SOCIAL_ICON_BY_KIND[link.kind] ?? ExternalLink,
	}));
	const avatarSource = identity.avatar_url.trim();
	const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
	const avatar =
		avatarSource && avatarSource !== failedAvatar ? avatarUrl(avatarSource, owner) : "";
	const customBanner = identity.hero.banner_url?.trim() ?? "";
	const hasCustomBanner = customBanner.length > 0;

	return (
		<section
			aria-label="首页序章"
			className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col justify-between overflow-hidden bg-background text-foreground"
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -top-12 z-0 overflow-hidden"
			>
				{hasCustomBanner ? (
					<img
						src={customBanner}
						alt=""
						className="size-full object-cover object-center opacity-35 dark:opacity-20"
					/>
				) : (
					<div className="relative size-full">
						<div className="absolute top-1/3 left-1/2 h-115 w-180 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[130px] dark:bg-primary/8" />
						<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--color-background)_80%)]" />
					</div>
				)}
			</div>

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
										alt={`${owner || siteName} 的头像`}
										variant="random"
										tileSize={40}
										duration={0.32}
										spreadMs={380}
										replayOnHover
										className="size-full"
										onError={() => setFailedAvatar(avatarSource)}
									/>
								</div>
							</figure>
						</div>
					) : null}

					<div
						className={
							avatar
								? "max-w-xl space-y-5 text-left"
								: "max-w-2xl space-y-5 text-center"
						}
					>
						<h1 className="text-4xl font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
							Hi, I&apos;m{" "}
							<span className="font-medium text-primary underline decoration-primary/35 decoration-wavy underline-offset-8 sm:underline-offset-10">
								{owner}
							</span>
							.
						</h1>

						<div className="space-y-4 text-left">
							<Epigraph
								quote={identity.hero.quote}
								translation={identity.hero.quote_translation}
								author={identity.hero.quote_author}
								variant="accent-line"
								captionAlign="end"
							/>

							<p className="font-serif text-sm leading-relaxed text-muted-foreground/85 sm:text-base">
								{identity.bio}
							</p>
						</div>

						<div
							className={`flex flex-wrap items-center gap-2.5 font-mono text-xs text-muted-foreground/80 ${avatar ? "" : "justify-center"}`}
						>
							<span>开源探索</span>
							{identity.location ? (
								<>
									<span aria-hidden className="text-muted-foreground/40">
										·
									</span>
									<span>{identity.location}</span>
								</>
							) : null}
						</div>

						{socialLinks.length > 0 ? (
							<TooltipPrimitive.Provider delayDuration={100}>
								<nav
									className={`flex items-center gap-2 pt-2 ${avatar ? "" : "justify-center"}`}
									aria-label="社交主页链接"
								>
									{socialLinks.map(({ href, label, Icon }) => (
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
								{HOME_KIND_LABEL[lead.kind]} ·{" "}
								{formatDate(lead.published_at, "dotted-date")}
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
						<span>开卷漫游</span>
						<ArrowDown className="size-3.5 transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none" />
					</a>
				</div>
			</div>
		</section>
	);
}

function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}
