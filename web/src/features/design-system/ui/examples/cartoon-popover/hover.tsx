import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { Button } from "@violet/ui";
import { MousePointerClick } from "lucide-react";

/** 悬停与点击双模触发方式对比。 */
export function CartoonPopoverHoverDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-4 py-6">
			<CartoonPopover triggerMode="hover">
				<CartoonPopoverTrigger asChild>
					<Button type="button" variant="outline" className="gap-1.5">
						<MousePointerClick className="size-4" />
						悬停显示 (Hover)
					</Button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="brand" title="悬停提示">
					<p className="text-xs">鼠标移入立即弹出，移入气泡内部继续保持，体验平滑。</p>
				</CartoonPopoverContent>
			</CartoonPopover>

			<CartoonPopover openOnHover>
				<CartoonPopoverTrigger asChild>
					<Button type="button" variant="outline">
						悬停或点击 (Both)
					</Button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="amber" title="双模触发" showClose>
					<p className="text-xs">既可悬停预览，也支持直接点击固定，带关闭胶囊。</p>
				</CartoonPopoverContent>
			</CartoonPopover>
		</div>
	);
}
