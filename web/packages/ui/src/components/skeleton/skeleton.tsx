import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				"animate-skeleton rounded-md bg-muted motion-reduce:animate-none",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
