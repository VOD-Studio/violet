import type { PublicPersona } from "@entities/persona/model/types";
import type { SiteIdentity } from "@entities/site-identity/model/types";
import { formatDate } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { Epigraph } from "@shared/ui/epigraph";
import { Avatar, Button, GithubIcon, ImagePixelReveal, iconProps } from "@violet/ui";
import { ArrowDown, ArrowRight, BookText, ExternalLink, Mail, Rss, Share2, Tv } from "lucide-react";
import { type ComponentType, type SVGProps, useState } from "react";
import { useApiDocsDialogStore } from "@/features/api-docs";

import { HomeContentLink } from "./HomeContentLink";
import { HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

/** 首页首屏资料与发布物查询状态。 */
export interface HomePreludeProps {
	identity: SiteIdentity;
	lead: HomePublicationItem | null;
	persona: PublicPersona | null;
	publicationError: boolean;
	publicationsLoading: boolean;
	publicationsRetrying: boolean;
	onRetryPublications: () => void;
}

const SOCIAL_ICON_BY_KIND: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	github: GithubIcon,
	twitter: XIcon,
	mastodon: Share2,
	email: Mail,
	bilibili: Tv,
	rss: Rss,
};

/** 站长介绍与内容出口；未配置的资料不补演示内容。 */
export function HomePrelude({
	identity,
	lead,
	persona,
	publicationError,
	publicationsLoading,
	publicationsRetrying,
	onRetryPublications,
}: HomePreludeProps) {
	const owner = identity.owner_name;
	const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
	const avatarSource = persona?.avatar.url.trim() || identity.avatar_url.trim();
	const avatar =
		avatarSource && avatarSource !== failedAvatar ? avatarUrl(avatarSource, owner) : "";
	const openApiDocs = useApiDocsDialogStore((s) => s.open);

	return (
		<section
			aria-label="首页序章"
			className="relative flex min-h-[calc(100svh-8rem)] w-full flex-col text-foreground lg:min-h-[calc(100svh-4rem)]"
		>
			{identity.hero.banner_url ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 overflow-hidden"
				>
					<img
						src={identity.hero.banner_url}
						alt=""
						decoding="async"
						className="size-full object-cover opacity-35 dark:opacity-20"
					/>
				</div>
			) : null}

			<div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-16 sm:px-8 md:py-20 lg:px-12">
				<div className="grid w-full items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14 lg:gap-16">
					<div className="mx-auto size-48 overflow-hidden rounded-xl bg-muted sm:size-56 md:mx-0 lg:size-60">
						{avatar ? (
							<ImagePixelReveal
								src={avatar}
								alt={`${owner} 的头像`}
								loading="eager"
								replayOnHover
								tileSize={40}
								className="size-full"
								onError={() => setFailedAvatar(avatarSource)}
							/>
						) : (
							<Avatar name={owner} size={96} shape="square" className="size-full" />
						)}
					</div>

					<div className="min-w-0 space-y-5">
						<h1 className="font-mono text-4xl font-normal leading-[1.12] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
							Hi, I&apos;m{" "}
							<span className="wrap-anywhere font-medium text-link underline decoration-decoration/35 decoration-wavy underline-offset-8 sm:underline-offset-10">
								{owner}
							</span>
							.
						</h1>

						{identity.hero.quote ? (
							<Epigraph
								quote={identity.hero.quote}
								translation={identity.hero.quote_translation}
								author={identity.hero.quote_author}
								variant="accent-line"
								captionAlign="end"
							/>
						) : null}

						{identity.bio ? (
							<p className="wrap-anywhere font-serif text-base leading-relaxed text-foreground/85">
								{identity.bio}
							</p>
						) : null}
						{identity.location ? (
							<p className="wrap-anywhere text-xs text-muted-foreground">
								{identity.location}
							</p>
						) : null}

						<nav aria-label="站长的链接" className="flex flex-wrap items-center gap-2">
							{identity.social_links.map(({ kind, href, label }) => {
								const Icon = SOCIAL_ICON_BY_KIND[kind] ?? ExternalLink;
								return (
									<Button key={`${kind}:${href}`} asChild>
										<a
											href={href}
											target={href.startsWith("http") ? "_blank" : undefined}
											rel={href.startsWith("http") ? "noreferrer" : undefined}
										>
											<Icon aria-hidden="true" />
											{label}
										</a>
									</Button>
								);
							})}
							{identity.subscription_channels.map((channel) => {
								const Icon = channel.kind === "rss" ? Rss : Mail;
								return (
									<Button key={`${channel.kind}:${channel.href}`} asChild>
										<a href={channel.href}>
											<Icon aria-hidden="true" />
											{channel.kind === "rss" ? "订阅" : channel.label}
										</a>
									</Button>
								);
							})}
							<Button
								onClick={openApiDocs}
								aria-haspopup="dialog"
								leftIcon={<BookText aria-hidden="true" />}
							>
								API 文档
							</Button>
						</nav>
					</div>
				</div>
			</div>

			<div className="relative border-t border-border/40 bg-background/50 backdrop-blur-md">
				<div className="mx-auto flex max-w-296 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-1.5 text-xs text-muted-foreground sm:px-8">
					<div className="min-w-0 flex-1 basis-48">
						{lead ? (
							<HomeContentLink
								item={lead}
								className="flex min-h-8 min-w-0 items-center gap-2 transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring pointer-coarse:min-h-11"
							>
								<span
									aria-hidden="true"
									className="size-1.5 shrink-0 rounded-full bg-decoration"
								/>
								<span className="shrink-0 font-medium text-foreground">
									最新发布
								</span>
								<span aria-hidden="true" className="text-border">
									/
								</span>
								<span className="truncate">{lead.title}</span>
								<time
									dateTime={lead.published_at}
									className="hidden shrink-0 tabular-nums sm:inline"
								>
									{HOME_KIND_LABEL[lead.kind]} ·{" "}
									{formatDate(
										lead.published_at,
										"dotted-date",
										undefined,
										"Asia/Shanghai",
									)}
								</time>
								<ArrowRight aria-hidden="true" {...iconProps(14, "shrink-0")} />
							</HomeContentLink>
						) : publicationError ? (
							<div className="flex flex-wrap items-center gap-2">
								<span role="alert">最新发布暂时无法加载。</span>
								<Button
									size="sm"
									variant="ghost"
									loading={publicationsRetrying}
									onClick={onRetryPublications}
								>
									重试
								</Button>
							</div>
						) : (
							<p role="status">
								{publicationsLoading
									? "正在获取最新发布…"
									: "还没有公开发布的内容。"}
							</p>
						)}
					</div>
					<a
						href="#recent"
						className="inline-flex min-h-8 shrink-0 items-center gap-2 transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring pointer-coarse:min-h-11"
					>
						开卷漫游
						<ArrowDown aria-hidden="true" {...iconProps(14)} />
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
