import { GithubIcon } from "@shared/ui/icons";
import { ArrowUpRight, AtSign, Mail, Rss, Share2, Tv } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

interface SocialEntry {
	label: string;
	href: string;
	target: string;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** 汇总已公开的社交与订阅入口。 */
export function SocialMatrixSection({ settings }: AboutSectionProps) {
	const candidates: Array<SocialEntry | null> = [
		settings.github_username
			? {
					label: "GitHub",
					href: `https://github.com/${settings.github_username}`,
					target: `@${settings.github_username}`,
					Icon: GithubIcon,
				}
			: null,
		settings.social_twitter
			? {
					label: "X / Twitter",
					href: settings.social_twitter,
					target: formatTarget(settings.social_twitter),
					Icon: AtSign,
				}
			: null,
		settings.social_mastodon
			? {
					label: "Mastodon",
					href: settings.social_mastodon,
					target: formatTarget(settings.social_mastodon),
					Icon: Share2,
				}
			: null,
		settings.social_email
			? {
					label: "Email",
					href: `mailto:${settings.social_email}`,
					target: settings.social_email,
					Icon: Mail,
				}
			: null,
		settings.social_rss
			? {
					label: "RSS",
					href: settings.social_rss,
					target: formatTarget(settings.social_rss),
					Icon: Rss,
				}
			: null,
		settings.social_bilibili
			? {
					label: "Bilibili",
					href: settings.social_bilibili,
					target: formatTarget(settings.social_bilibili),
					Icon: Tv,
				}
			: null,
	];
	const entries = candidates.filter((entry): entry is SocialEntry => entry !== null);

	if (entries.length === 0) return null;

	return (
		<AboutChapter
			id="social_matrix"
			title="还可以在哪里找到我？"
			intro="如果想聊技术、交换友链，或者继续看看我在写什么，下面这些入口都可以。"
		>
			<nav className={styles.socialList} aria-label="站长公开链接">
				{entries.map(({ label, href, target, Icon }) => {
					const isExternal = href.startsWith("http");
					return (
						<a
							key={label}
							href={href}
							target={isExternal ? "_blank" : undefined}
							rel={isExternal ? "noopener noreferrer" : undefined}
							className={styles.socialLink}
							aria-label={`${label}：${target}`}
						>
							<span className={styles.socialIconWrap}>
								<Icon className={styles.socialIcon} aria-hidden />
							</span>
							<span className={styles.socialText}>
								<span className={styles.socialLabel}>{label}</span>
								<span className={styles.socialTarget}>{target}</span>
							</span>
							<ArrowUpRight className={styles.socialArrow} aria-hidden />
						</a>
					);
				})}
			</nav>
		</AboutChapter>
	);
}

function formatTarget(value: string): string {
	return value.replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/$/, "");
}
