import { GithubIcon } from "@shared/ui/icons";
import { ArrowUpRight, AtSign, Globe2, Mail, Rss, Video } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import styles from "./SocialLinksCard.module.css";
import type { ArticleSocialLink, SocialLinkIcon, SocialLinksEmbedConfig } from "./types";

interface SocialLinksCardProps {
	config: SocialLinksEmbedConfig;
}

const ICONS: Record<SocialLinkIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
	github: GithubIcon,
	x: XIcon,
	email: Mail,
	website: Globe2,
	rss: Rss,
	video: Video,
};

function inferredIcon(link: ArticleSocialLink): SocialLinkIcon {
	if (link.icon) return link.icon;
	if (link.href.startsWith("mailto:")) return "email";
	if (link.href.includes("github.com")) return "github";
	if (link.href.includes("x.com") || link.href.includes("twitter.com")) return "x";
	return "website";
}

/** 将作者声明的少量社交入口组织成可扫描的文章内导航。 */
export function SocialLinksCard({ config }: SocialLinksCardProps) {
	return (
		<nav className={styles.grid} aria-label="社交链接">
			{config.links.map((link) => {
				const Icon = ICONS[inferredIcon(link)] ?? AtSign;
				const external = /^https?:\/\//iu.test(link.href);
				return (
					<a
						key={`${link.label}:${link.href}`}
						href={link.href}
						target={external ? "_blank" : undefined}
						rel={external ? "noopener noreferrer" : undefined}
						className={styles.item}
					>
						<span className={styles.icon}>
							<Icon aria-hidden />
						</span>
						<span className={styles.copy}>
							<strong>{link.label}</strong>
							{link.handle ? <small>{link.handle}</small> : null}
						</span>
						<ArrowUpRight className={styles.arrow} aria-hidden />
					</a>
				);
			})}
		</nav>
	);
}

function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg {...props} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<title>X</title>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
		</svg>
	);
}
