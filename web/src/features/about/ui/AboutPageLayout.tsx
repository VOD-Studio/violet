import type { SiteSettings } from "@features/settings/model/types";
import { useActiveHeading } from "@shared/hooks/use-toc";
import { avatarUrl } from "@shared/lib/image-url";
import { ProfileMention } from "@shared/ui/article-embeds";
import { type SectionNavigationItem, SectionNavigator } from "@shared/ui/section-navigator";
import { Signature } from "@shared/ui/signature";
import { type ReactNode, useRef } from "react";

import styles from "./AboutPage.module.css";

interface AboutPageLayoutProps {
	settings: SiteSettings;
	sections: SectionNavigationItem[];
	children: ReactNode;
}

/** 关于页固定开场、章节流与响应式页内索引。 */
export function AboutPageLayout({ settings, sections, children }: AboutPageLayoutProps) {
	const contentRef = useRef<HTMLElement>(null);
	const activeId = useActiveHeading(contentRef);
	const siteName = normalizeSiteName(settings.site_name);
	const ownerName = settings.github_username.trim() || siteName;
	const siteHost = formatSiteHost(settings.site_url);
	const avatar = settings.avatar_url.trim();
	const profileHref = settings.github_username.trim()
		? `https://github.com/${settings.github_username.trim()}`
		: settings.site_url || "/about";
	const profileDescription =
		settings.tagline.trim() || settings.bio.split(/\n/)[0]?.trim() || undefined;

	return (
		<main className={styles.page}>
			<header id="about-top" className={styles.intro}>
				<div className={styles.introCopy}>
					<h1 className={styles.title}>关于</h1>
					<p className={styles.summary}>
						关于 {siteName}，也关于{" "}
						<ProfileMention
							label={ownerName}
							profile={{
								name: ownerName,
								subtitle: settings.profile_role.trim() || `${siteName} 的维护者`,
								description: profileDescription,
								avatarUrl: avatar ? avatarUrl(avatar, ownerName) : undefined,
								href: profileHref,
							}}
						/>
						的一份公开档案。内容会随站点一起生长。
					</p>
					{siteHost ? (
						<a className={styles.siteLink} href={settings.site_url}>
							{siteHost}
						</a>
					) : null}
				</div>
				<div className={styles.byline} role="group" aria-label={`署名：${ownerName}`}>
					<span className={styles.bylineLabel}>署名</span>
					<Signature name={ownerName} size="lg" autoPlay replayOnHover />
				</div>
			</header>

			<div className={styles.contentGrid}>
				<article ref={contentRef} className={styles.chapterFlow}>
					{sections.length > 0 ? (
						children
					) : (
						<p className={styles.empty}>更多内容正在整理中。</p>
					)}
				</article>
				{sections.length > 0 ? (
					<SectionNavigator
						items={sections}
						activeId={activeId}
						title="档案索引"
						ariaLabel="关于页章节"
						className={styles.navigator}
					/>
				) : null}
			</div>
		</main>
	);
}

function normalizeSiteName(value: string): string {
	const name = value.trim();
	return !name || /^(my\s+)?blog$/i.test(name) ? "Violet" : name;
}

function formatSiteHost(value: string): string {
	if (!value) return "";
	try {
		return new URL(value).hostname.replace(/^www\./, "");
	} catch {
		return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
	}
}
