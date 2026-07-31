import { parseJsonList } from "@features/about/model/parse-json-list";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** project_stack JSON 的条目 */
interface StackItem {
    name: string;
    icon?: string;
    purpose?: string;
}

/**
 * ProjectStackSection - B5 项目技术栈
 *
 * 展示造这个博客用了什么（Go/React/PG 等），每条带图标 + 用途说明。
 * 数据来自 settings.project_stack（JSON {stack:[{name,icon,purpose}]}）。
 */
export function ProjectStackSection({ settings }: AboutSectionProps) {
    const items = parseJsonList<StackItem>(settings.project_stack, "stack");
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
                    技术栈
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((item, i) => (
                        <motion.div
                            key={item.name}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: i * 0.04 }}
                            className="flex items-center gap-3 rounded-lg border border-edge-hairline bg-muted/30 px-4 py-3"
                        >
                            {item.icon ? <span className="text-xl">{item.icon}</span> : null}
                            <div>
                                <span className="font-mono text-sm font-medium">{item.name}</span>
                                {item.purpose ? (
                                    <p className="text-xs text-muted-foreground">{item.purpose}</p>
                                ) : null}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
