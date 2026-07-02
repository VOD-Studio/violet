import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { cn } from "@shared/lib/utils";

export interface ProjectsSkeletonProps {
    className?: string;
}

const ProjectsSkeleton = ({ className }: ProjectsSkeletonProps) => {
    const cards = Array.from({ length: 4 }, (_, i) => i);

    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-8 md:grid-cols-2",
                className,
            )}
        >
            {cards.map((index) => (
                <div
                    key={index}
                    className="h-64 rounded-3xl border border-edge-hairline p-8"
                >
                    <ShimmerSkeleton className="mb-4 h-8 w-3/4 rounded-md" />
                    <ShimmerSkeleton className="h-5 w-full rounded-md" />
                    <ShimmerSkeleton className="mt-2 h-5 w-5/6 rounded-md" />
                </div>
            ))}
        </div>
    );
};

export default ProjectsSkeleton;
