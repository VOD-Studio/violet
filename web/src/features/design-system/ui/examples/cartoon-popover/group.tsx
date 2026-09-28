import { CartoonPopoverGroup, CartoonPopoverGroupItem } from "@shared/ui/cartoon-popover";
import { Button } from "@violet/ui";

/** 并排群组触发器的连续平滑滑行气泡。 */
export function CartoonPopoverGroupDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3 py-6">
			<CartoonPopoverGroup>
				<CartoonPopoverGroupItem
					value="default"
					trigger={
						<Button size="sm" variant="outline">
							Default
						</Button>
					}
					variant="default"
					title="Default"
				>
					<p className="text-xs">经典单行文本，高度紧凑。</p>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="brand"
					trigger={
						<Button size="sm" variant="outline">
							Brand
						</Button>
					}
					variant="brand"
					title="Brand 品牌色"
				>
					<div className="space-y-1 text-xs">
						<p>冷香紫罗兰专属方言底色。</p>
						<p className="text-muted-foreground">内容变化时平滑拉伸高度！</p>
					</div>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="amber"
					trigger={
						<Button size="sm" variant="outline">
							Amber
						</Button>
					}
					variant="amber"
					title="Amber 元气黄"
				>
					<div className="space-y-1 text-xs">
						<p>暖阳提示信息，内容行数更多。</p>
						<p>鼠标横向滑过这一排按钮时：</p>
						<p className="text-muted-foreground">浮层平滑滑过去，绝不闪现。</p>
					</div>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="mint"
					trigger={
						<Button size="sm" variant="outline">
							Mint
						</Button>
					}
					variant="mint"
					title="Mint 清新绿"
				>
					<p className="text-xs">回到单行，高度再次自适应收缩。</p>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="rose"
					trigger={
						<Button size="sm" variant="outline">
							Rose
						</Button>
					}
					variant="rose"
					title="Rose 蜜桃粉"
				>
					<p className="text-xs">活泼软萌的趣味点缀说明。</p>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="sky"
					trigger={
						<Button size="sm" variant="outline">
							Sky
						</Button>
					}
					variant="sky"
					title="Sky 晴空蓝"
				>
					<div className="space-y-1 text-xs">
						<p>轻盈微风色调。</p>
						<p className="text-muted-foreground">离开整排按钮后统一缓冲收起。</p>
					</div>
				</CartoonPopoverGroupItem>

				<CartoonPopoverGroupItem
					value="dark"
					trigger={
						<Button size="sm" variant="outline">
							Dark
						</Button>
					}
					variant="dark"
					title="Dark 夜墨"
				>
					<p className="text-xs">紫黑底与低亮灰紫描线，轮廓先成、文字后显。</p>
				</CartoonPopoverGroupItem>
			</CartoonPopoverGroup>
		</div>
	);
}
