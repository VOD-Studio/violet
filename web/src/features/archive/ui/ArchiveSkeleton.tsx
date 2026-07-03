import { cn } from "@shared/lib/utils";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

export interface ArchiveSkeletonProps {
    className?: string;
}

const ArchiveSkeleton = ({ className }: ArchiveSkeletonProps) => {
    const years = Array.from({ length: 2 }, (_, i) => i);

    return (
        <div className={cn("space-y-10", className)}>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                    <ShimmerSkeleton key={i} className="h-8 w-16 rounded-full" />
                ))}
            </div>

            {years.map((index) => (
                <div key={index} className="space-y-4">
                    <ShimmerSkeleton className="h-7 w-40 rounded-md" />
                    <div className="space-y-3 border-l-2 border-border pl-4">
                        {Array.from({ length: 4 }, (_, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <ShimmerSkeleton className="mt-0.5 h-4 w-10 rounded-md" />
                                <div className="flex flex-1 flex-col gap-1">
                                    <ShimmerSkeleton className="h-4 w-full rounded-md" />
                                    <div className="flex flex-wrap gap-1">
                                        {Array.from({ length: 2 }, (_, j) => (
                                            <ShimmerSkeleton
                                                key={j}
                                                className="h-5 w-12 rounded-full"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ArchiveSkeleton;
