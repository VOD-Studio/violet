import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";
import { parseJsonList } from "./ProjectStackSection";

/** thanks JSON 的条目 */
interface ThankItem {
    name: string;
    url?: string;
    reason?: string;
}

/**
 * ThanksSection - B7 开源致谢
 *
 * 列出造这个博客用到的开源项目。数据来自 settings.thanks
 * （JSON {thanks:[{name,url,reason}]}）。
 */
export function ThanksSection({ settings }: AboutSectionProps) {
    const items = parseJsonList<ThankItem>(settings.thanks, "thanks");
    if (items.length === 0) return null;

    return (
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-2xl"
            >
                <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    开源致谢
                </h2>
                <div className="flex flex-wrap gap-2">
                    {items.map((item, i) =>
                        item.url ? (
                            <motion.a
                                key={item.name}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.reason ?? item.name}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: i * 0.03 }}
                                className="rounded-lg border border-edge-hairline bg-muted/30 px-3 py-1.5 font-mono text-sm transition-colors hover:border-primary/50 hover:bg-accent"
                            >
                                {item.name}
                            </motion.a>
                        ) : (
                            <motion.span
                                key={item.name}
                                title={item.reason ?? item.name}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: i * 0.03 }}
                                className="rounded-lg border border-edge-hairline bg-muted/30 px-3 py-1.5 font-mono text-sm"
                            >
                                {item.name}
                            </motion.span>
                        ),
                    )}
                </div>
            </motion.div>
        </section>
    );
}
