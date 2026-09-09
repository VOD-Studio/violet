import { DEFAULT_ABOUT_COPY } from "@features/about/model/default-copy";
import { Briefcase, Hand, Mail, MapPin } from "lucide-react";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 以出版物式索引展示身份、位置与联系状态。 */
export function ProfileCardSection({ settings }: AboutSectionProps) {
	const rows = [
		{
			icon: Briefcase,
			key: "身份",
			value: settings.profile_role.trim() || DEFAULT_ABOUT_COPY.role,
		},
		{
			icon: MapPin,
			key: "坐标",
			value: settings.profile_location.trim() || DEFAULT_ABOUT_COPY.location,
		},
		{
			icon: Hand,
			key: "近况",
			value: settings.available_for.trim() || DEFAULT_ABOUT_COPY.availableFor,
		},
		settings.social_email
			? { icon: Mail, key: "来信", value: settings.social_email.trim() }
			: null,
	].filter((row): row is NonNullable<typeof row> => row !== null);

	return (
		<section className={styles.section} aria-labelledby="about-profile-title">
			<AboutSectionIntro
				id="about-profile-title"
				eyebrow="Coordinates / 03"
				title="此刻，我在哪里。"
			/>
			<dl className={styles.ledger}>
				{rows.map(({ icon: Icon, key, value }) => (
					<div key={key} className={styles.ledgerRow}>
						<dt className={styles.ledgerKey}>
							<Icon className={styles.ledgerIcon} aria-hidden="true" />
							{key}
						</dt>
						<dd className={styles.ledgerValue}>{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
