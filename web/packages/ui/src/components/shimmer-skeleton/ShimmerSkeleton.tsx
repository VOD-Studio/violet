import { cn } from "cn";
import type * as React from "react";

/**
 * 材质骨架：凹陷底色，1.8s 呼吸起伏，减弱动态下静止。
 */
function ShimmerSkeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="shimmer-skeleton"
			className={cn(
				"animate-skeleton rounded-md bg-muted motion-reduce:animate-none",
				className,
			)}
			{...props}
		/>
	);
}

export { ShimmerSkeleton };
