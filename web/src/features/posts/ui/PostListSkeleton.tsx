import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { cn } from "@shared/lib/utils";

export interface PostListSkeletonProps {
    mixedSizes?: ("sm" | "md" | "lg")[];
    className?: string;
}

const PostListSkeleton = ({
    mixedSizes = ["md", "md", "lg"],
    className,
}: PostListSkeletonProps) => {
    const cards = Array.from({ length: 6 }, (_, i) => mixedSizes[i % mixedSizes.length] ?? "md");

    return (
        <div
            className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start",
                className,
            )}
        >
            {cards.map((size, index) => {
                const coverH =
                    size === "lg" ? "h-56" : size === "sm" ? "h-32" : "h-44";

                return (
                    <div
                        key={index}
                        className="flex flex-col overflow-hidden rounded-lg border border-edge-hairline bg-background"
                    >
                        <ShimmerSkeleton className={cn("w-full", coverH)} />
                        <div className="flex flex-col gap-3 p-5">
                            <ShimmerSkeleton className="h-5 w-20 rounded-full" />
                            <ShimmerSkeleton className="h-6 w-full rounded-md" />
                            <ShimmerSkeleton className="h-4 w-full rounded-md" />
                            <ShimmerSkeleton className="h-4 w-2/3 rounded-md" />
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5">
                                    <ShimmerSkeleton className="h-5 w-5 rounded-full" />
                                    <ShimmerSkeleton className="h-3 w-16 rounded-md" />
                                </div>
                                <ShimmerSkeleton className="h-3 w-20 rounded-md" />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PostListSkeleton;
