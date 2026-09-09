import { DEFAULT_ABOUT_COPY } from "@features/about/model/default-copy";
import styles from "./AboutPage.module.css";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 以头像和一句话主张建立作者身份。 */
export function AvatarTaglineSection({ settings }: AboutSectionProps) {
	const siteName = settings.site_name.trim() || DEFAULT_ABOUT_COPY.siteName;
	const tagline = settings.tagline.trim() || DEFAULT_ABOUT_COPY.tagline;

	return (
		<section className={styles.section} aria-labelledby="about-identity-title">
			<div className={styles.identity}>
				<div className={styles.avatarRail}>
					{settings.avatar_url ? (
						<img
							src={settings.avatar_url}
							alt={`${siteName} 站长头像`}
							width={176}
							height={176}
							className={styles.avatar}
						/>
					) : (
						<span className={styles.avatarFallback} aria-hidden="true">
							{siteName.slice(0, 1)}
						</span>
					)}
				</div>
				<div className={styles.identityCopy}>
					<span className={styles.identityLabel}>About me / 01</span>
					<h2 id="about-identity-title" className={styles.identityTitle}>
						{tagline}
					</h2>
					<p className={styles.identitySite}>{siteName} · Digital garden</p>
				</div>
			</div>
		</section>
	);
}
