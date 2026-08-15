import { cn } from "@shared/lib/utils";

/** LabDirection - 博客排版实验室方向标识 */
export type LabDirection = "cascade" | "terminal" | "rail" | "bento" | "paper" | "film" | "toc";

const Bar = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
	<div className={cn("animate-pulse rounded bg-muted", className)} style={style} />
);

/**
 * BlogSkeleton - 各方向的加载骨架
 *
 * 骨架形状跟随对应方向的布局语言（瀑布高度错落 / 终端行式 / 轨道条目…），
 * 而不是通用转圈。
 */
export function BlogSkeleton({ direction }: { direction: LabDirection }) {
	switch (direction) {
		case "cascade":
			return (
				<div>
					<Bar className="mb-8 aspect-[21/9] w-full rounded-2xl" />
					<div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
						{/* 高度错落的占位块，模拟瀑布流的自然节奏 */}
						{[220, 160, 190, 140, 200, 170, 180, 150].map((h, i) => (
							<div
								key={i}
								className="mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-edge-hairline"
							>
								<Bar className="w-full" style={{ height: h }} />
								<div className="space-y-2 p-5">
									<Bar className="h-4 w-3/4" />
									<Bar className="h-3 w-full" />
									<Bar className="h-3 w-2/3" />
								</div>
							</div>
						))}
					</div>
				</div>
			);

		case "terminal":
			return (
				<div className="font-mono">
					<Bar className="mb-4 h-4 w-56" />
					{[92, 70, 84, 60, 78, 66, 88, 72].map((w, i) => (
						<div
							key={i}
							className="flex items-center gap-3 border-b border-edge-hairline/60 py-2.5"
						>
							<Bar className="h-3.5 w-20" />
							<Bar className="h-3.5" style={{ width: `${w}%` }} />
						</div>
					))}
				</div>
			);

		case "rail":
			return (
				<div className="relative ml-2 pl-10">
					<div className="absolute top-0 bottom-0 left-0 w-px bg-edge-hairline" />
					{[0, 1, 2, 3, 4].map((i) => (
						<div key={i} className="relative pb-12">
							<div className="absolute top-1 -left-[41px] size-2.5 rounded-full bg-muted" />
							<Bar className="h-3 w-24" />
							<Bar className="mt-2 h-5 w-2/3" />
							<Bar className="mt-3 h-3 w-full max-w-md" />
						</div>
					))}
				</div>
			);

		case "bento":
			return (
				<div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:grid-cols-4">
					{[0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5].map((slot, i) => {
						const spans = [
							"md:col-span-2 md:row-span-2",
							"md:row-span-2",
							"md:col-span-2",
							"",
							"",
							"md:col-span-2",
						];
						return <Bar key={i} className={cn("rounded-xl", spans[slot])} />;
					})}
				</div>
			);

		case "paper":
			return (
				<div>
					<Bar className="mb-3 h-5 w-full rounded-none" />
					<div className="border-b border-edge-hairline py-8">
						<Bar className="h-9 w-4/5" />
						<Bar className="mt-4 h-4 w-3/5" />
					</div>
					<div className="grid md:grid-cols-3">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="py-6 md:border-l md:px-5 md:first:border-l-0 md:first:pl-0"
							>
								<Bar className="aspect-video w-full" />
								<Bar className="mt-3 h-4 w-4/5" />
								<Bar className="mt-2 h-3 w-full" />
							</div>
						))}
					</div>
				</div>
			);

		case "film":
			return (
				<div className="py-2">
					<Bar className="mb-5 h-2 w-full opacity-20" />
					<div className="flex gap-4 overflow-hidden">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="w-60 shrink-0">
								<Bar className="aspect-video w-full rounded-lg" />
								<Bar className="mt-2 h-3.5 w-4/5" />
							</div>
						))}
					</div>
					<Bar className="mt-5 h-2 w-full opacity-20" />
				</div>
			);

		case "toc":
			return (
				<div>
					<Bar className="mb-4 h-3 w-28" />
					<Bar className="h-10 w-4/5" />
					<Bar className="mt-3 h-4 w-3/5" />
					<div className="mt-8 grid gap-x-12 md:grid-cols-2">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="space-y-2 border-b border-edge-hairline py-5">
								<Bar className="h-4 w-3/4" />
								<Bar className="h-3 w-full" />
							</div>
						))}
					</div>
				</div>
			);
	}
}
