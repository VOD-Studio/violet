import { GithubIcon } from "@shared/ui/icons";
import { ArrowUpRight, Clapperboard, Mail, MessageCircle, Network, Rss } from "lucide-react";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 展示已经配置的站外入口，不为缺失账号生成虚假链接。 */
export function SocialMatrixSection({ settings }: AboutSectionProps) {
	const entries = [
		settings.github_username
			? {
					label: "GitHub",
					href: `https://github.com/${encodeURIComponent(settings.github_username)}`,
					sub: `@${settings.github_username}`,
					icon: GithubIcon,
				}
			: null,
		settings.social_twitter
			? {
					label: "X / Twitter",
					href: settings.social_twitter,
					sub: "即时动态",
					icon: MessageCircle,
				}
			: null,
		settings.social_mastodon
			? {
					label: "Mastodon",
					href: settings.social_mastodon,
					sub: "去中心化动态",
					icon: Network,
				}
			: null,
		settings.social_email
			? {
					label: "Email",
					href: `mailto:${settings.social_email}`,
					sub: settings.social_email,
					icon: Mail,
				}
			: null,
		settings.social_rss
			? { label: "RSS", href: settings.social_rss, sub: "订阅所有新文章", icon: Rss }
			: null,
		settings.social_bilibili
			? {
					label: "Bilibili",
					href: settings.social_bilibili,
					sub: "视频与生活",
					icon: Clapperboard,
				}
			: null,
	].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

	if (entries.length === 0) return null;

	return (
		<section className={styles.section} aria-labelledby="about-social-title">
			<AboutSectionIntro
				id="about-social-title"
				eyebrow="Connect / 05"
				title="如果想找到我。"
			/>
			<div className={styles.socialGrid}>
				{entries.map(({ label, href, sub, icon: Icon }) => {
					const isMail = href.startsWith("mailto:");
					return (
						<a
							key={label}
							href={href}
							target={isMail ? undefined : "_blank"}
							rel={isMail ? undefined : "noopener noreferrer"}
							className={styles.socialLink}
						>
							<span className={styles.socialIcon}>
								<Icon aria-hidden="true" />
							</span>
							<span className={styles.socialText}>
								<span className={styles.socialLabel}>{label}</span>
								<span className={styles.socialSub}>{sub}</span>
							</span>
							<ArrowUpRight className={styles.socialArrow} aria-hidden="true" />
						</a>
					);
				})}
			</div>
		</section>
	);
}
