import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { cn } from "@shared/lib/utils";

export interface ContributionsSkeletonProps {
    className?: string;
}

const WEEK_DAYS = 7;
const WEEKS_SHOWN = 53;

const ContributionsSkeleton = ({ className }: ContributionsSkeletonProps) => {
    const weeks = Array.from({ length: WEEKS_SHOWN }, (_, weekIndex) => weekIndex);

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <ShimmerSkeleton className="h-4 w-32 rounded-md" />
                    <ShimmerSkeleton className="h-8 w-48 rounded-md" />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <span>少</span>
                    {Array.from({ length: 5 }, (_, i) => (
                        <ShimmerSkeleton
                            key={i}
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm"
                        />
                    ))}
                    <span>多</span>
                </div>
            </div>

            <div className="flex gap-1 sm:gap-1.5">
                {weeks.map((week) => (
                    <div key={week} className="flex flex-col flex-1 min-w-0 gap-1">
                        {Array.from({ length: WEEK_DAYS }, (_, day) => (
                            <ShimmerSkeleton
                                key={day}
                                className="w-full aspect-square rounded-sm"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContributionsSkeleton;
