import { Briefcase, Hand, type LucideIcon, Mail, MapPin } from "lucide-react";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

interface ProfileRow {
	Icon: LucideIcon;
	label: string;
	value: string;
	href?: string;
}

/** 以定义列表呈现当前身份、位置与联系状态。 */
export function ProfileCardSection({ settings }: AboutSectionProps) {
	const rows = [
		settings.profile_role
			? { Icon: Briefcase, label: "身份", value: settings.profile_role }
			: null,
		settings.profile_location
			? { Icon: MapPin, label: "所在", value: settings.profile_location }
			: null,
		settings.available_for
			? { Icon: Hand, label: "近况", value: settings.available_for }
			: null,
		settings.social_email
			? {
					Icon: Mail,
					label: "邮件",
					value: settings.social_email,
					href: `mailto:${settings.social_email}`,
				}
			: null,
	].filter((row): row is ProfileRow => row !== null);

	if (rows.length === 0) return null;

	return (
		<AboutChapter
			id="profile_card"
			title="此刻的我"
			intro="不写一长串履历，只留下现在仍然有效的信息。"
		>
			<dl className={styles.profileList}>
				{rows.map(({ Icon, label, value, href }) => (
					<div key={label} className={styles.profileRow}>
						<Icon className={styles.profileIcon} aria-hidden />
						<dt className={styles.profileTerm}>{label}</dt>
						<dd className={styles.profileValue}>
							{href ? <a href={href}>{value}</a> : value}
						</dd>
					</div>
				))}
			</dl>
		</AboutChapter>
	);
}
