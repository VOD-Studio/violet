import { Button } from "@shared/ui/button";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";

export interface ComingSoonProps {
	title: string;
}

/**
 * ComingSoon - 占位页（Nexus 视觉）
 *
 * 标题 + shimmer 占位块 + 返回首页。
 * 替代简陋「建设中」文案。
 */
const ComingSoon = ({ title }: ComingSoonProps) => {
	return (
		<div className="container mx-auto px-4 py-24">
			<div className="mx-auto max-w-xl">
				<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					In Construction
				</p>
				<h1 className="mb-8 font-mono text-4xl font-bold">{title}</h1>
				<div className="space-y-3">
					<ShimmerSkeleton className="h-4 w-3/4" />
					<ShimmerSkeleton className="h-4 w-1/2" />
					<ShimmerSkeleton className="h-24 w-full" />
				</div>
				<div className="mt-8">
					<Button asChild variant="outline">
						<Link to="/">返回首页</Link>
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ComingSoon;
