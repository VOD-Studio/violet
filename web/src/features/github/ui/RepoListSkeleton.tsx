import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { cn } from "@shared/lib/utils";

export interface RepoListSkeletonProps {
    className?: string;
}

const RepoListSkeleton = ({ className }: RepoListSkeletonProps) => {
    const cards = Array.from({ length: 6 }, (_, i) => i);

    return (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
            {cards.map((index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-lg border border-edge-hairline bg-background p-5"
                >
                    <div className="flex items-start justify-between gap-3">
                        <ShimmerSkeleton className="h-5 w-3/4 rounded-md" />
                        <ShimmerSkeleton className="h-4 w-12 rounded-full" />
                    </div>
                    <ShimmerSkeleton className="h-4 w-full rounded-md" />
                    <ShimmerSkeleton className="h-4 w-5/6 rounded-md" />
                    <div className="mt-auto flex items-center gap-4 pt-2">
                        <ShimmerSkeleton className="h-3 w-14 rounded-md" />
                        <ShimmerSkeleton className="h-3 w-14 rounded-md" />
                        <ShimmerSkeleton className="ml-auto h-3 w-4 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RepoListSkeleton;
