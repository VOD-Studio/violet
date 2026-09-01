import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps, MouseEventHandler } from "react";

type LinkTo = ComponentProps<typeof Link>["to"];

/**
 * BackLink - 全站统一的常态返回入口
 *
 * 幽灵返回钮：常态只有深色文字与箭头（无框无底），hover 浮出软底
 * 圆角洗底并左移箭头——比描边胶囊安静，比裸 muted 文本更有可点性。
 * 位置统一：lab 页 / 文章页 / nav 演示文都放内容区左上角。to 缺省
 * 时渲染为不可导航的演示态，nav lab 演示区用——点击不应离开 lab。
 */
const entryClass =
	"group -ml-3 inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";

const arrowClass = "size-4 transition-transform group-hover:-translate-x-0.5";

export function BackLink({
	label,
	to,
	className,
	onClick,
}: {
	label: string;
	to?: LinkTo;
	className?: string;
	onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
	if (to) {
		return (
			<Link to={to} className={cn(entryClass, className)} onClick={onClick}>
				<ArrowLeft className={arrowClass} />
				{label}
			</Link>
		);
	}
	return (
		<span className={cn(entryClass, className)}>
			<ArrowLeft className={arrowClass} />
			{label}
		</span>
	);
}
