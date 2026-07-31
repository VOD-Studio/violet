import { usePublicStats } from "@features/about/api/queries";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * LiveStatsSection - B2 站点生命体征
 *
 * 展示文章数 / 总字数 / 评论数 / 运行天数的跳动大字。
 * 用 motion 的数字插值动画驱动从 0 滚到目标值。
 * 接口失败时空数据降级（不渲染）。
 */
export function LiveStatsSection(_: AboutSectionProps) {
    const { data } = usePublicStats();

    if (!data) return null;

    const items = [
        { label: "文章", value: data.posts_count },
        { label: "总字数", value: data.total_words },
        { label: "评论", value: data.comments_count },
        { label: "运行天数", value: data.uptime_days },
    ];

    return (
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4"
            >
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <CountUp
                            to={item.value}
                            className="block text-4xl font-black tracking-tighter md:text-5xl"
                        />
                        <span className="mt-2 block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {item.label}
                        </span>
                    </div>
                ))}
            </motion.div>
        </section>
    );
}

/**
 * CountUp - 从 0 滚动到目标值的数字（requestAnimationFrame 驱动 easeOut 缓动）
 *
 * 用 rAF 自实现插值，避免依赖 motion 的命令式 animate API（签名不稳）。
 */
function CountUp({ to, className }: { to: number; className?: string }) {
    const [value, setValue] = useState(0);
    const rafRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const duration = 1200;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(eased * to));
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            }
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [to]);

    return <span className={className}>{value.toLocaleString()}</span>;
}
