import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { ImagePixelReveal } from "@shared/ui/image-pixel-reveal";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 用真实头像与站点标语完成关于页的见面段落。 */
export function AvatarTaglineSection({ settings }: AboutSectionProps) {
	const avatar = settings.avatar_url.trim();
	const tagline = settings.tagline.trim();
	if (!avatar && !tagline) return null;

	const siteName = settings.site_name.trim() || "Violet";
	const ownerName = settings.github_username.trim() || siteName;

	return (
		<AboutChapter id="avatar_tagline" title="先打个招呼">
			<div className={cn(styles.identity, !avatar && styles.identityTextOnly)}>
				{avatar ? (
					<div className={styles.avatarFrame}>
						<ImagePixelReveal
							src={avatarUrl(avatar, ownerName)}
							alt={`${ownerName} 的头像`}
							variant="random"
							tileSize={32}
							duration={0.28}
							spreadMs={320}
							replayOnHover
							className={styles.avatarReveal}
						/>
					</div>
				) : null}
				<div className={styles.identityText}>
					<p className={styles.identityName}>{ownerName}</p>
					<p className={styles.tagline}>{tagline || siteName}</p>
				</div>
			</div>
		</AboutChapter>
	);
}
