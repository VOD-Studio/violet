import { Briefcase, Hand, Mail, MapPin } from "lucide-react";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * ProfileCardSection - A2 名片卡
 *
 * 展示 role / location / available_for / email。空字段不显示对应行。
 * 横向 flex-wrap 布局，与内容流宽度一致（不再孤立窄卡片）。
 */
export function ProfileCardSection({ settings }: AboutSectionProps) {
	const rows = [
		settings.profile_role ? { icon: Briefcase, label: settings.profile_role } : null,
		settings.profile_location ? { icon: MapPin, label: settings.profile_location } : null,
		settings.available_for ? { icon: Hand, label: settings.available_for } : null,
		settings.social_email ? { icon: Mail, label: settings.social_email } : null,
	].filter((r): r is { icon: typeof Briefcase; label: string } => r !== null);

	if (rows.length === 0) return null;

	return (
		<section className="mx-auto w-full max-w-5xl px-6 py-14">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.6 }}
				className="flex flex-wrap gap-x-8 gap-y-3"
			>
				{rows.map(({ icon: Icon, label }) => (
					<div key={label} className="flex items-center gap-2 text-sm text-foreground/80">
						<Icon className="size-4 shrink-0 text-muted-foreground" />
						<span>{label}</span>
					</div>
				))}
			</motion.div>
		</section>
	);
}
