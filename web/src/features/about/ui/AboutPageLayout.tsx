import type { SiteSettings } from "@features/settings/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { ProfileMention } from "@shared/ui/article-embeds";
import { Signature } from "@shared/ui/signature";
import type { ReactNode } from "react";

import styles from "./AboutPage.module.css";

interface AboutPageLayoutProps {
	settings: SiteSettings;
	hasSections: boolean;
	children: ReactNode;
}

/** 关于页固定开场与连续章节流。 */
export function AboutPageLayout({ settings, hasSections, children }: AboutPageLayoutProps) {
	const siteName = normalizeSiteName(settings.site_name);
	const githubUsername = settings.github_username.trim();
	const ownerName = githubUsername || siteName;
	const headline = settings.tagline.trim() || "写代码，也写字。";
	const siteHost = formatSiteHost(settings.site_url);
	const avatar = settings.avatar_url.trim();
	const profileHref = githubUsername
		? `https://github.com/${githubUsername}`
		: settings.site_url || "/about";
	const profileDescription =
		settings.tagline.trim() || settings.bio.split(/\n/)[0]?.trim() || undefined;

	return (
		<main className={styles.page}>
			<header id="about-top" className={styles.intro}>
				<div className={styles.introCopy}>
					<p className={styles.eyebrow}>ABOUT · {siteName}</p>
					<h1 className={styles.title}>{headline}</h1>
					<div className={styles.summary}>
						<p>
							你好，我是{" "}
							<ProfileMention
								label={ownerName}
								actionLabel={githubUsername ? "去 GitHub 看看" : "打开主页"}
								profile={{
									name: ownerName,
									subtitle:
										settings.profile_role.trim() || `${siteName} 的维护者`,
									description: profileDescription,
									avatarUrl: avatar ? avatarUrl(avatar, ownerName) : undefined,
									href: profileHref,
								}}
							/>
							。我写代码，也写文章。
						</p>
						<p>
							{siteName}
							是我整理技术、设计与生活思考的地方；新的文章和新的代码，会让它继续变化。
						</p>
					</div>
					{siteHost ? (
						<a className={styles.siteLink} href={settings.site_url}>
							{siteHost}
						</a>
					) : null}
				</div>
				<div className={styles.byline} role="group" aria-label={`署名：${ownerName}`}>
					<span className={styles.bylineLabel}>写于</span>
					<Signature name={ownerName} size="lg" autoPlay replayOnHover />
				</div>
			</header>

			<article className={styles.chapterFlow}>
				{hasSections ? children : <p className={styles.empty}>更多内容正在慢慢写下。</p>}
			</article>
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
