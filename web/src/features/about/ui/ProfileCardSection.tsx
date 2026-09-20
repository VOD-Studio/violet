import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 将当前身份、所在地与联系状态写成文章中的一段话。 */
export function ProfileCardSection({ settings }: AboutSectionProps) {
	const role = settings.profile_role.trim();
	const location = settings.profile_location.trim();
	const availableFor = settings.available_for.trim();
	const email = settings.social_email.trim();

	if (!role && !location && !availableFor && !email) return null;

	return (
		<section id="profile_card" className={styles.profileNote} aria-label="当前状态">
			<p>
				{role ? (
					<>
						现在，我以 <strong>{role}</strong> 这个身份工作。
					</>
				) : null}
				{location ? <>坐标 {location}。</> : null}
				{availableFor ? (
					<>
						最近：<mark className={styles.inlineMark}>{availableFor}</mark>。
					</>
				) : null}
				{email ? (
					<>
						也可以直接
						<a className={styles.inlineLink} href={`mailto:${email}`}>
							写邮件
						</a>
						。
					</>
				) : null}
			</p>
		</section>
	);
}
