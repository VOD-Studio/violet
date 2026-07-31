import { Briefcase, Hand, Mail, MapPin } from "lucide-react";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * ProfileCardSection - A2 名片卡
 *
 * 展示 role / location / available_for / email 的卡片。空字段不显示对应行。
 * 消费 settings.profile_role / profile_location / available_for / social_email。
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
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-md rounded-xl border border-edge-hairline bg-background p-6 shadow-sm"
            >
                <div className="space-y-4">
                    {rows.map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm text-foreground/80">{label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
