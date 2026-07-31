import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * AvatarTaglineSection - A1 头像 + 标语
 *
 * 圆形头像（avatar_url）+ 大字 tagline。avatar_url 为空时隐藏头像只显示 tagline。
 * 消费 settings.avatar_url / settings.tagline。
 */
export function AvatarTaglineSection({ settings }: AboutSectionProps) {
    if (!settings.tagline && !settings.avatar_url) return null;

    return (
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center"
            >
                {settings.avatar_url ? (
                    <img
                        src={settings.avatar_url}
                        alt="头像"
                        className="size-28 rounded-full border border-edge-hairline object-cover shadow-sm"
                    />
                ) : null}
                {settings.tagline ? (
                    <p className="text-2xl font-bold tracking-tight md:text-3xl">
                        {settings.tagline}
                    </p>
                ) : null}
            </motion.div>
        </section>
    );
}
