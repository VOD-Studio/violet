import { cn } from "@shared/lib/utils";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

export interface ProjectsSkeletonProps {
    className?: string;
}

const ProjectsSkeleton = ({ className }: ProjectsSkeletonProps) => {
    const cards = Array.from({ length: 4 }, (_, i) => i);

    return (
        <div className={cn("grid grid-cols-1 gap-8 md:grid-cols-2", className)}>
            {cards.map((index) => (
                <div
                    key={index}
                    className="flex flex-col overflow-hidden rounded-3xl border border-edge-hairline"
                >
                    <div className="aspect-video bg-muted" />
                    <div className="p-6">
                        <ShimmerSkeleton className="mb-3 h-7 w-3/4 rounded-md" />
                        <ShimmerSkeleton className="mb-2 h-4 w-full rounded-md" />
                        <ShimmerSkeleton className="mb-4 h-4 w-5/6 rounded-md" />
                        <div className="mb-4 flex gap-1.5">
                            <ShimmerSkeleton className="h-5 w-14 rounded-full" />
                            <ShimmerSkeleton className="h-5 w-16 rounded-full" />
                            <ShimmerSkeleton className="h-5 w-12 rounded-full" />
                        </div>
                        <div className="flex gap-2">
                            <ShimmerSkeleton className="h-8 w-20 rounded-md" />
                            <ShimmerSkeleton className="h-8 w-20 rounded-md" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProjectsSkeleton;
