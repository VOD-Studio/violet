import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { Button } from "@violet/ui";
import { HelpCircle, MessageCircle } from "lucide-react";

/** 对白气泡与便签贴纸两种形态对比。 */
export function CartoonPopoverStylesDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-4 py-6">
			<CartoonPopover>
				<CartoonPopoverTrigger asChild>
					<Button type="button" variant="outline" className="gap-1.5">
						<MessageCircle className="size-4" />
						对白气泡
					</Button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent bubbleStyle="speech" title="漫画对白" showClose>
					<p className="text-xs">平滑连通的三角形小尾巴，精准指向触发器中心。</p>
				</CartoonPopoverContent>
			</CartoonPopover>

			<CartoonPopover>
				<CartoonPopoverTrigger asChild>
					<Button type="button" variant="outline" className="gap-1.5">
						<HelpCircle className="size-4" />
						便签贴纸
					</Button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent
					bubbleStyle="sticker"
					variant="amber"
					shadowStyle="comic"
					title="便签贴纸"
					showClose
				>
					<p className="text-xs">不带小尾巴的圆润卡片，搭配 3px 漫画实色投影。</p>
				</CartoonPopoverContent>
			</CartoonPopover>
		</div>
	);
}
