import { Button } from "@shared/ui/base/button";
import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverGroup,
	CartoonPopoverGroupItem,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { HelpCircle, MessageCircle, MousePointerClick } from "lucide-react";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { ComponentDemo } from "./ComponentDemo";

const BASIC_CODE = `import { Button } from "@shared/ui/base/button";
import {
  CartoonPopover,
  CartoonPopoverContent,
  CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";

function Example() {
  return (
    <CartoonPopover>
      <CartoonPopoverTrigger asChild>
        <Button variant="default">打开卡通气泡</Button>
      </CartoonPopoverTrigger>
      <CartoonPopoverContent
        title="温馨提示"
        description="带有对白尾巴的卡通气泡。"
        showClose
      >
        <p className="text-xs">支持视口防溢出自动对齐，点击外部或 Esc 关闭。</p>
      </CartoonPopoverContent>
    </CartoonPopover>
  );
}`;

const HOVER_CODE = `<div className="flex flex-wrap gap-4">
  {/* 悬停触发 */}
  <CartoonPopover triggerMode="hover">
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">悬停显示 (Hover)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="brand" title="悬停提示">
      <p className="text-xs">鼠标移入立即弹出，移入气泡内部继续保持。</p>
    </CartoonPopoverContent>
  </CartoonPopover>

  {/* 点击与悬停兼备 */}
  <CartoonPopover openOnHover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">悬停或点击 (Both)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="amber" title="双模触发" showClose>
      <p className="text-xs">支持鼠标悬停浮出，也支持直接点击固定。</p>
    </CartoonPopoverContent>
  </CartoonPopover>
</div>`;

const GROUP_CODE = `<CartoonPopoverGroup>
  <CartoonPopoverGroupItem
    value="default"
    trigger={<Button size="sm" variant="outline">Default</Button>}
    variant="default"
    title="Default"
  >
    <p className="text-xs">经典单行文本，高度紧凑。</p>
  </CartoonPopoverGroupItem>

  <CartoonPopoverGroupItem
    value="brand"
    trigger={<Button size="sm" variant="outline">Brand</Button>}
    variant="brand"
    title="Brand 品牌色"
  >
    <div className="space-y-1 text-xs">
      <p>冷香紫罗兰专属方言底色。</p>
      <p className="text-muted-foreground">内容变化时平滑拉伸高度。</p>
    </div>
  </CartoonPopoverGroupItem>

  <CartoonPopoverGroupItem
    value="amber"
    trigger={<Button size="sm" variant="outline">Amber</Button>}
    variant="amber"
    title="Amber 元气黄"
  >
    <div className="space-y-1 text-xs">
      <p>暖阳提示信息，内容更丰富。</p>
      <p>鼠标在这一排按钮间滑过时：</p>
      <p className="text-muted-foreground">气泡平滑滑过去，绝不一闪一闪！</p>
    </div>
  </CartoonPopoverGroupItem>

  <CartoonPopoverGroupItem
    value="mint"
    trigger={<Button size="sm" variant="outline">Mint</Button>}
    variant="mint"
    title="Mint 清新绿"
  >
    <p className="text-xs">回到单行，高度再次顺畅收缩。</p>
  </CartoonPopoverGroupItem>

  <CartoonPopoverGroupItem
    value="rose"
    trigger={<Button size="sm" variant="outline">Rose</Button>}
    variant="rose"
    title="Rose 蜜桃粉"
  >
    <p className="text-xs">活泼软萌的趣味点缀。</p>
  </CartoonPopoverGroupItem>

  <CartoonPopoverGroupItem
    value="sky"
    trigger={<Button size="sm" variant="outline">Sky</Button>}
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
    trigger={<Button size="sm" variant="outline">Dark</Button>}
    variant="dark"
    title="Dark 夜墨"
  >
    <p className="text-xs">紫黑底与低亮灰紫描线，轮廓先成、文字后显。</p>
  </CartoonPopoverGroupItem>
</CartoonPopoverGroup>`;

const STYLES_CODE = `<div className="flex flex-wrap gap-4">
  {/* 经典对白气泡 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">对白气泡 (Speech)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent bubbleStyle="speech" title="漫画对白" showClose>
      <p className="text-xs">平滑连通的三角形小尾巴，精准指向触发器中心。</p>
    </CartoonPopoverContent>
  </CartoonPopover>

  {/* 便签贴纸 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">便签贴纸 (Sticker)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent bubbleStyle="sticker" variant="amber" shadowStyle="comic" title="便签贴纸" showClose>
      <p className="text-xs">不带小尾巴的圆润卡片，搭配 3px 漫画实色投影。</p>
    </CartoonPopoverContent>
  </CartoonPopover>
</div>`;

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const PROP_COLUMNS: ApiTableColumn<PropRow>[] = [
	{
		label: "属性",
		render: (row) => (
			<span className="font-mono text-xs font-semibold text-foreground">{row.name}</span>
		),
	},
	{
		label: "类型",
		render: (row) => (
			<span className="font-mono text-[11px] text-muted-foreground">{row.type}</span>
		),
	},
	{
		label: "默认值",
		render: (row) => (
			<span className="font-mono text-xs text-muted-foreground">{row.defaultValue}</span>
		),
	},
	{
		label: "说明",
		render: (row) => <span className="text-xs text-foreground">{row.meaning}</span>,
	},
];

const ROOT_PROPS: PropRow[] = [
	{
		name: "open",
		type: "boolean",
		defaultValue: "—",
		meaning: "受控打开状态。",
	},
	{
		name: "defaultOpen",
		type: "boolean",
		defaultValue: "false",
		meaning: "默认非受控打开状态。",
	},
	{
		name: "onOpenChange",
		type: "(open: boolean) => void",
		defaultValue: "—",
		meaning: "打开或关闭时的状态变更回调。",
	},
	{
		name: "triggerMode",
		type: '"click" | "hover" | "both"',
		defaultValue: '"click"',
		meaning: "触发模式：仅点击、仅悬停、或两者均可。",
	},
	{
		name: "openOnHover",
		type: "boolean",
		defaultValue: "false",
		meaning: '快捷开启悬停触发，等价于 triggerMode="both"。',
	},
	{
		name: "hoverDelay",
		type: "number",
		defaultValue: "80",
		meaning: "鼠标悬停触发的防抖延迟时间（毫秒）。",
	},
	{
		name: "closeDelay",
		type: "number",
		defaultValue: "150",
		meaning: "鼠标离开触发器和气泡的关闭缓冲延迟（毫秒），允许鼠标移入气泡操作。",
	},
];

const CONTENT_PROPS: PropRow[] = [
	{
		name: "side",
		type: '"top" | "bottom" | "left" | "right"',
		defaultValue: '"bottom"',
		meaning: "期望展示在触发器的哪一侧；空间不足时自动翻转。",
	},
	{
		name: "align",
		type: '"start" | "center" | "end"',
		defaultValue: '"center"',
		meaning: "相对触发器的对齐方式。",
	},
	{
		name: "sideOffset",
		type: "number",
		defaultValue: "14",
		meaning: "气泡与触发器的间距（像素），尾巴凸出 8px 保留安全呼吸感。",
	},
	{
		name: "bubbleStyle",
		type: '"speech" | "sticker"',
		defaultValue: '"speech"',
		meaning: "气泡形态：经典对白三角形尾巴，或无尾巴的便签贴纸卡片。",
	},
	{
		name: "variant",
		type: '"default" | "brand" | "amber" | "mint" | "rose" | "sky" | "dark"',
		defaultValue: '"default"',
		meaning: "卡通色彩变体，自动匹配气泡背景、描边与尾巴颜色。",
	},
	{
		name: "shadowStyle",
		type: '"soft" | "comic"',
		defaultValue: '"soft"',
		meaning: "投影风格：遵循站内规范的轻微软影或 3px 漫画实色投影。",
	},
	{
		name: "showArrow",
		type: "boolean",
		defaultValue: "true",
		meaning: "是否渲染指向触发器中心的气泡小尾巴，已消除边框横线阻隔。",
	},
	{
		name: "showShine",
		type: "boolean",
		defaultValue: "true",
		meaning: "是否在气泡内壁渲染卡通高光微胶囊。",
	},
	{
		name: "title",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "可选快捷标题；传入时自动渲染头部。",
	},
	{
		name: "divided",
		type: "boolean",
		defaultValue: "false",
		meaning: "头部与正文之间是否显示虚线分隔线（默认不显示）。",
	},
	{
		name: "showClose",
		type: "boolean",
		defaultValue: "false",
		meaning: "是否渲染右上角卡通圆形关闭按钮。",
	},
];

const GROUP_PROPS: PropRow[] = [
	{
		name: "sideOffset",
		type: "number",
		defaultValue: "14",
		meaning: "浮层与触发器的间距（像素）。",
	},
	{
		name: "closeDelay",
		type: "number",
		defaultValue: "180",
		meaning: "鼠标离开整排群组的收起缓冲延迟（毫秒）。",
	},
];

export function CartoonPopoverDocPage() {
	return (
		<article className="space-y-12 pb-16">
			{/* 头部导言 */}
			<header className="space-y-3">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>浮层</span>
					<span aria-hidden="true">·</span>
					<span>CartoonPopover</span>
				</div>
				<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
					CartoonPopover 卡通气泡
				</h1>
				<p className="text-sm leading-relaxed text-muted-foreground">
					轮廓从小尾巴尖端起笔、一笔连通圆角边框向两侧描绘，关闭时沿原路收回并淡去，不缩放整块内容。并排触发器间连续滑行，减少动效时即时开合。
				</p>
				<p className="font-mono text-xs text-muted-foreground">
					源码 web/src/shared/ui/cartoon-popover/CartoonPopover.tsx
				</p>
			</header>

			{/* 基础用法演练 */}
			<section aria-labelledby="usage-heading" className="space-y-4">
				<h2 id="usage-heading" className="text-xl font-semibold text-foreground">
					用法
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					从 shared/ui/cartoon-popover 导入。点击触发器即可弹出，支持外部点击与 Escape
					自动关闭。
				</p>
				<ComponentDemo code={BASIC_CODE}>
					<div className="flex justify-center py-6">
						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="default">
									打开卡通气泡
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent
								title="你好，旅人！"
								description="欢迎来到紫罗兰的营造法式典籍。"
								showClose
								side="bottom"
								variant="brand"
							>
								<div className="space-y-1 pt-1 text-xs">
									<p>对白小尾巴与气泡边框平滑连通，内部背景无阻隔。</p>
									<p className="text-muted-foreground">
										支持点击、悬停与视口防溢出自动对齐。
									</p>
								</div>
							</CartoonPopoverContent>
						</CartoonPopover>
					</div>
				</ComponentDemo>
			</section>

			{/* 连续平滑滑动群组 */}
			<section aria-labelledby="group-heading" className="space-y-4">
				<h2 id="group-heading" className="text-xl font-semibold text-foreground">
					并排连续平滑移动 (CartoonPopoverGroup)
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					当有一排带有 Popover 的按钮时，使用 CartoonPopoverGroup
					包裹。鼠标滑过时共享浮层平滑滑动过去，小尾巴连续跟随，内容高度不同时自动平滑拉伸变形，杜绝一闪一闪的重新弹出。
				</p>
				<ComponentDemo code={GROUP_CODE}>
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
									<p className="text-muted-foreground">
										内容变化时平滑拉伸高度！
									</p>
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
									<p className="text-muted-foreground">
										浮层平滑滑过去，绝不闪现。
									</p>
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
									<p className="text-muted-foreground">
										离开整排按钮后统一缓冲收起。
									</p>
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
								<p className="text-xs">
									紫黑底与低亮灰紫描线，轮廓先成、文字后显。
								</p>
							</CartoonPopoverGroupItem>
						</CartoonPopoverGroup>
					</div>
				</ComponentDemo>
			</section>

			{/* 悬停与触发方式 */}
			<section aria-labelledby="hover-heading" className="space-y-4">
				<h2 id="hover-heading" className="text-xl font-semibold text-foreground">
					触发方式 (triggerMode & hover)
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					支持仅点击（click）、仅悬停（hover）或两者兼具（both /
					openOnHover）。悬停模式下移入气泡内容区保持打开，鼠标离开后平滑收起。
				</p>
				<ComponentDemo code={HOVER_CODE}>
					<div className="flex flex-wrap items-center justify-center gap-4 py-6">
						<CartoonPopover triggerMode="hover">
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline" className="gap-1.5">
									<MousePointerClick className="size-4" />
									悬停显示 (Hover)
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent variant="brand" title="悬停提示">
								<p className="text-xs">
									鼠标移入立即弹出，移入气泡内部继续保持，体验平滑。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>

						<CartoonPopover openOnHover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline">
									悬停或点击 (Both)
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent variant="amber" title="双模触发" showClose>
								<p className="text-xs">
									既可悬停预览，也支持直接点击固定，带关闭胶囊。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>
					</div>
				</ComponentDemo>
			</section>

			{/* 气泡形态 */}
			<section aria-labelledby="styles-heading" className="space-y-4">
				<h2 id="styles-heading" className="text-xl font-semibold text-foreground">
					气泡形态 (bubbleStyle)
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					提供带三角形小尾巴的经典对白气泡（speech）与无尾巴的便签贴纸（sticker）。
				</p>
				<ComponentDemo code={STYLES_CODE}>
					<div className="flex flex-wrap items-center justify-center gap-4 py-6">
						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline" className="gap-1.5">
									<MessageCircle className="size-4" />
									对白气泡
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent bubbleStyle="speech" title="漫画对白" showClose>
								<p className="text-xs">
									平滑连通的三角形小尾巴，精准指向触发器中心。
								</p>
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
								<p className="text-xs">
									不带小尾巴的圆润卡片，搭配 3px 漫画实色投影。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>
					</div>
				</ComponentDemo>
			</section>

			{/* API 参数契约表格 */}
			<section aria-labelledby="api-heading" className="space-y-6">
				<h2 id="api-heading" className="text-xl font-semibold text-foreground">
					公开契约
				</h2>

				<div className="space-y-3">
					<h3 className="text-sm font-semibold text-foreground">
						CartoonPopover 根组件参数
					</h3>
					<ApiTable<PropRow>
						title="CartoonPopover 根组件参数"
						columns={PROP_COLUMNS}
						rows={ROOT_PROPS}
						rowKey={(r) => r.name}
					/>
				</div>

				<div className="space-y-3">
					<h3 className="text-sm font-semibold text-foreground">
						CartoonPopoverGroup 群组参数
					</h3>
					<ApiTable<PropRow>
						title="CartoonPopoverGroup 参数"
						columns={PROP_COLUMNS}
						rows={GROUP_PROPS}
						rowKey={(r) => r.name}
					/>
				</div>

				<div className="space-y-3">
					<h3 className="text-sm font-semibold text-foreground">
						CartoonPopoverContent 内容面板参数
					</h3>
					<ApiTable<PropRow>
						title="CartoonPopoverContent 参数"
						columns={PROP_COLUMNS}
						rows={CONTENT_PROPS}
						rowKey={(r) => r.name}
					/>
				</div>
			</section>
		</article>
	);
}
