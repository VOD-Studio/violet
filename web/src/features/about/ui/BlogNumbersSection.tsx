import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";
import { parseJsonList } from "./ProjectStackSection";

/** blog_numbers JSON 的条目 */
interface NumberItem {
    label: string;
    value: string;
}

/**
 * BlogNumbersSection - B6 这座博客的数字
 *
 * 展示代码行数 / commit 数 / 部署次数等针对本项目的聚合数字。
 * 数据来自 settings.blog_numbers（JSON {numbers:[{label,value}]}），
 * 当前为手工维护（YAGNI，将来可扩 public-stats 接口取活数据）。
 */
export function BlogNumbersSection({ settings }: AboutSectionProps) {
    const items = parseJsonList<NumberItem>(settings.blog_numbers, "numbers");
    if (items.length === 0) return null;

    return (
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-3"
            >
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <span className="block text-3xl font-black tracking-tighter md:text-4xl">
                            {item.value}
                        </span>
                        <span className="mt-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {item.label}
                        </span>
                    </div>
                ))}
            </motion.div>
        </section>
    );
}
