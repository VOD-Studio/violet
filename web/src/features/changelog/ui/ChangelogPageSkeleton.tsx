import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

/**
 * ChangelogPageSkeleton - 更新日志页骨架屏
 *
 * 1:1 模拟真实布局：标题区 + 时间线版本块（圆点 + 版本号 + 分类 pill + 条目行）。
 * 参照 ArchiveSkeleton 的 border-l 时间线骨架先例。
 */
export function ChangelogPageSkeleton() {
    return (
        <main className="mx-auto w-full max-w-4xl px-6 py-20">
            <header className="mb-16">
                <ShimmerSkeleton className="mb-2 h-3 w-24" />
                <ShimmerSkeleton className="h-10 w-44" />
                <ShimmerSkeleton className="mt-3 h-4 w-56" />
            </header>
            <div className="relative space-y-14 border-l border-edge-hairline pl-10">
                {Array.from({ length: 3 }, (_, v) => (
                    <div key={v} className="relative">
                        <ShimmerSkeleton className="absolute -left-11.75 top-2 size-3.5 rounded-full" />
                        <div className="flex items-baseline gap-4">
                            <ShimmerSkeleton className="h-7 w-24" />
                            <ShimmerSkeleton className="h-4 w-20" />
                        </div>
                        <div className="mt-6 space-y-7">
                            <div>
                                <ShimmerSkeleton className="h-5 w-14 rounded-full" />
                                <div className="mt-3 space-y-2.5">
                                    <ShimmerSkeleton className="h-4 w-full" />
                                    <ShimmerSkeleton className="h-4 w-5/6" />
                                    <ShimmerSkeleton className="h-4 w-2/3" />
                                </div>
                            </div>
                            <div>
                                <ShimmerSkeleton className="h-5 w-14 rounded-full" />
                                <div className="mt-3 space-y-2.5">
                                    <ShimmerSkeleton className="h-4 w-4/5" />
                                    <ShimmerSkeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
