import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

export interface ArchiveYearSkeletonProps {
    year: number;
}

const ArchiveYearSkeleton = ({ year }: ArchiveYearSkeletonProps) => {
    return (
        <section className="scroll-mt-20 space-y-4">
            <h2 className="mb-4 text-xl font-bold">
                {year} <span className="text-muted-foreground">· -- 篇</span>
            </h2>
            <div className="space-y-6">
                {Array.from({ length: 2 }, (_, monthIndex) => (
                    <div key={monthIndex}>
                        <ShimmerSkeleton className="mb-2 h-5 w-16 rounded-md" />
                        <ul className="space-y-2 border-l-2 border-border pl-4">
                            {Array.from({ length: 3 }, (_, itemIndex) => (
                                <li
                                    key={itemIndex}
                                    className="flex items-start gap-3"
                                >
                                    <ShimmerSkeleton className="mt-0.5 h-4 w-10 rounded-md" />
                                    <div className="flex flex-1 flex-col gap-1">
                                        <ShimmerSkeleton className="h-4 w-full rounded-md" />
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from({ length: 2 }, (_, tagIndex) => (
                                                <ShimmerSkeleton
                                                    key={tagIndex}
                                                    className="h-5 w-12 rounded-full"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ArchiveYearSkeleton;
