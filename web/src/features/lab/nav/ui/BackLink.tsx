import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";

type LinkTo = ComponentProps<typeof Link>["to"];

/**
 * BackLink - 全站统一的常态返回入口
 *
 * lab 页头（← Labs）与文章页头（← 博客）共用：页头胶囊是返回的常态
 * 位置，滚动离场后由 /lab/nav 各方向接管。胶囊与滚动态浮层（描边 +
 * 半透明底 + 箭头）同一视觉语言。to 缺省时渲染为不可导航的演示态，
 * nav lab 演示区用——点击不应带用户离开 lab。
 */
const pillClass =
	"group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-edge-hairline bg-background/50 px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-background hover:text-foreground";

const arrowClass = "size-4 transition-transform group-hover:-translate-x-0.5";

export function BackLink({
	label,
	to,
	className,
}: {
	label: string;
	to?: LinkTo;
	className?: string;
}) {
	if (to) {
		return (
			<Link to={to} className={cn(pillClass, className)}>
				<ArrowLeft className={arrowClass} />
				{label}
			</Link>
		);
	}
	return (
		<span className={cn(pillClass, className)}>
			<ArrowLeft className={arrowClass} />
			{label}
		</span>
	);
}
