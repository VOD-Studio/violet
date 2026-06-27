import { cn } from "@shared/lib/utils";

/** 步骤项 */
export interface StepItem {
    /** 标题 */
    title: string;
    /** 描述（可选） */
    description?: string;
}

export interface StepsProps {
    /** 步骤列表 */
    steps: StepItem[];
    /** 当前激活到第几步（0-based）。激活后线条与节点依次点亮 */
    current: number;
    className?: string;
}

/**
 * PhysicalSteps - 物理时间轴
 *
 * spec 铁律：线条动画必须**完全到达**下一节点后，该节点 dot 才点亮。
 * 实现：每段连线 width 用 transition 300ms，下个节点的 dot 用
 * transition-delay 300ms，保证物理先后顺序。
 *
 * 不引起 reflow：所有动画走 transform/width 在固定布局内。
 */
function PhysicalSteps({ steps, current, className }: StepsProps) {
    return (
        <ol className={cn("flex flex-col gap-0", className)}>
            {steps.map((step, i) => {
                const isDone = i < current;
                const isActive = i === current;
                const nextReached = i < current; // 第 i 段线连到 i+1，i+1 已亮则线全亮
                return (
                    <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
                        {/* 节点列 */}
                        <div className="relative flex flex-col items-center">
                            {/* 当前节点 dot */}
                            <span
                                className={cn(
                                    "size-3 rounded-full border transition-colors duration-300",
                                    isActive || isDone
                                        ? "border-neon-blue bg-neon-blue shadow-[0_0_12px_hsl(var(--glow-soft)/0.6)]"
                                        : "border-border bg-background",
                                )}
                                style={{
                                    // 节点点亮延迟 300ms = 连线到达后
                                    transitionDelay: i > 0 ? "300ms" : "0ms",
                                }}
                            />
                            {/* 连接到下一节点的线（在两节点之间） */}
                            {i < steps.length - 1 && (
                                <span
                                    className="mt-1 w-px flex-1 bg-border"
                                    style={{
                                        background: nextReached
                                            ? "linear-gradient(to bottom, hsl(var(--neon-blue)), hsl(var(--border)))"
                                            : undefined,
                                    }}
                                >
                                    <span
                                        className="block h-full w-full origin-top transition-transform duration-300"
                                        style={{
                                            transform: nextReached ? "scaleY(1)" : "scaleY(0)",
                                            background: nextReached
                                                ? "hsl(var(--neon-blue))"
                                                : "transparent",
                                        }}
                                    />
                                </span>
                            )}
                        </div>
                        {/* 文本列 */}
                        <div className="pt-0.5">
                            <p
                                className={cn(
                                    "font-medium transition-colors duration-300",
                                    isActive || isDone
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {step.title}
                            </p>
                            {step.description ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            ) : null}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export { PhysicalSteps };
