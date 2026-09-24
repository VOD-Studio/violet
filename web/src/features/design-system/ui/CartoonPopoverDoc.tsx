import { Button } from "@shared/ui/base/button";
import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { HelpCircle, MessageCircle, MousePointerClick, Sparkles } from "lucide-react";
import { useState } from "react";
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
        <Button variant="default">打开气泡</Button>
      </CartoonPopoverTrigger>
      <CartoonPopoverContent
        title="温馨提示"
        description="带有对白尾巴与果冻弹性弹出动效的卡通气泡。"
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

  {/* 思考气泡 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">思考气泡 (Thought)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent bubbleStyle="thought" variant="brand" title="心里在想…" showClose>
      <p className="text-xs">由双层微动小圆点依次延伸，表达思考与内心独白。</p>
    </CartoonPopoverContent>
  </CartoonPopover>

  {/* 贴纸气泡 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">贴纸气泡 (Sticker)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent bubbleStyle="sticker" variant="amber" shadowStyle="comic" title="便签贴纸">
      <p className="text-xs">没有小尾巴的圆润卡片，搭配 3px 漫画实色投影。</p>
    </CartoonPopoverContent>
  </CartoonPopover>
</div>`;

const VARIANTS_CODE = `<div className="flex flex-wrap gap-3">
  {/* 经典黑白 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Default</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="default" title="经典黑白">黑白漫画勾线与纯粹背景。</CartoonPopoverContent>
  </CartoonPopover>

  {/* 紫罗兰 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Brand</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="brand" title="冷香紫罗兰">站点品牌方言专属底色。</CartoonPopoverContent>
  </CartoonPopover>

  {/* 暖阳黄 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Amber</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="amber" title="元气向日葵">温暖亮眼的提示信息。</CartoonPopoverContent>
  </CartoonPopover>

  {/* 清新绿 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Mint</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="mint" title="清新薄荷">清爽温和的正向反馈。</CartoonPopoverContent>
  </CartoonPopover>

  {/* 蜜桃粉 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Rose</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="rose" title="甜美蜜桃">活泼软萌的趣味点缀。</CartoonPopoverContent>
  </CartoonPopover>

  {/* 晴空蓝 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button size="sm" variant="outline">Sky</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent variant="sky" title="白云晴空">轻盈平静的说明信息。</CartoonPopoverContent>
  </CartoonPopover>
</div>`;

const ANIMATION_CODE = `<div className="flex flex-wrap gap-4">
  {/* 果冻弹性 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="default">果冻弹性 (Jelly)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent animation="jelly" title="Q 弹果冻" showClose>
      带有冲过头微回弹与轻微倾斜，呈现地道的卡通弹动感。
    </CartoonPopoverContent>
  </CartoonPopover>

  {/* 俏皮弹跳 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">俏皮弹跳 (Bounce)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent animation="bounce" title="向上微弹" showClose>
      从下方微抬弹跳并淡入，手感利落紧凑。
    </CartoonPopoverContent>
  </CartoonPopover>

  {/* 平滑淡入 */}
  <CartoonPopover>
    <CartoonPopoverTrigger asChild>
      <Button variant="outline">平滑淡入 (Fade)</Button>
    </CartoonPopoverTrigger>
    <CartoonPopoverContent animation="fade" title="无位移淡入" showClose>
      纯透明度过渡，在减弱动画偏好时会自动降级为本模式。
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
		defaultValue: "12",
		meaning: "气泡与触发器的间距（像素），尾巴凸出 8px 保留安全呼吸感。",
	},
	{
		name: "bubbleStyle",
		type: '"speech" | "thought" | "sticker"',
		defaultValue: '"speech"',
		meaning: "气泡形态：经典对白三角形尾巴、思考小圆点尾巴或无尾巴贴纸。",
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
		name: "animation",
		type: '"jelly" | "bounce" | "fade"',
		defaultValue: '"jelly"',
		meaning: "卡通动效：果冻弹性、单次弹跳或纯淡入。",
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
		meaning: "可选快捷标题；传入时自动渲染虚线分隔的卡通头部。",
	},
	{
		name: "showClose",
		type: "boolean",
		defaultValue: "false",
		meaning: "是否渲染右上角卡通圆形关闭按钮。",
	},
];

export function CartoonPopoverDocPage() {
	const [activeVariant, setActiveVariant] = useState<
		"default" | "brand" | "amber" | "mint" | "rose" | "sky" | "dark"
	>("brand");

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
					卡通风格气泡浮层，支持点击与悬停触发、对白小尾巴与思考气泡形态，包含果冻回弹动效与多种色彩变体。
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
								<Button type="button" variant="default" className="gap-2">
									<Sparkles className="size-4" />
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
								<Button type="button" variant="outline" className="gap-1.5">
									<Sparkles className="size-4" />
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
					提供对白气泡（speech）、思考气泡（thought）与贴纸气泡（sticker）。
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
									思考气泡
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent
								bubbleStyle="thought"
								variant="brand"
								title="心里在想…"
								showClose
							>
								<p className="text-xs">
									由双层微动小圆点依次延伸，表达思考与内心独白。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>

						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline">
									贴纸气泡
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent
								bubbleStyle="sticker"
								variant="amber"
								shadowStyle="comic"
								title="便签贴纸"
							>
								<p className="text-xs">
									没有小尾巴的圆润卡片，搭配 3px 漫画实色投影。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>
					</div>
				</ComponentDemo>
			</section>

			{/* 色彩变体演练 */}
			<section aria-labelledby="variants-heading" className="space-y-4">
				<h2 id="variants-heading" className="text-xl font-semibold text-foreground">
					色彩变体 (variant)
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					收录 7 组经过对比度校准的卡通色板，背景、墨线边框与小尾巴颜色自动联动。
				</p>
				<ComponentDemo code={VARIANTS_CODE}>
					<div className="flex flex-wrap items-center justify-center gap-3 py-6">
						{(
							["default", "brand", "amber", "mint", "rose", "sky", "dark"] as const
						).map((v) => (
							<CartoonPopover key={v}>
								<CartoonPopoverTrigger asChild>
									<Button
										type="button"
										size="sm"
										variant={activeVariant === v ? "default" : "outline"}
										onClick={() => setActiveVariant(v)}
										className="capitalize"
									>
										{v}
									</Button>
								</CartoonPopoverTrigger>
								<CartoonPopoverContent
									variant={v}
									title={`${v.toUpperCase()} 变体`}
									showClose
								>
									<p className="text-xs">
										背景色与小尾巴自动精准咬合，边框带有 2px 漫画墨线。
									</p>
								</CartoonPopoverContent>
							</CartoonPopover>
						))}
					</div>
				</ComponentDemo>
			</section>

			{/* 动画效果 */}
			<section aria-labelledby="animation-heading" className="space-y-4">
				<h2 id="animation-heading" className="text-xl font-semibold text-foreground">
					动画效果 (animation)
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					内置三种卡通动效曲线：果冻弹性（jelly）、俏皮微弹（bounce）与无位移平滑淡入（fade）。
				</p>
				<ComponentDemo code={ANIMATION_CODE}>
					<div className="flex flex-wrap items-center justify-center gap-4 py-6">
						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="default">
									果冻弹性 (Jelly)
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent animation="jelly" title="Q 弹果冻" showClose>
								<p className="text-xs">
									带有冲过头微回弹与轻微倾斜，呈现地道的卡通弹动感。
								</p>
							</CartoonPopoverContent>
						</CartoonPopover>

						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline">
									俏皮弹跳 (Bounce)
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent animation="bounce" title="向上微弹" showClose>
								<p className="text-xs">从下方微抬弹跳并淡入，手感利落紧凑。</p>
							</CartoonPopoverContent>
						</CartoonPopover>

						<CartoonPopover>
							<CartoonPopoverTrigger asChild>
								<Button type="button" variant="outline">
									平滑淡入 (Fade)
								</Button>
							</CartoonPopoverTrigger>
							<CartoonPopoverContent animation="fade" title="无位移淡入" showClose>
								<p className="text-xs">
									纯透明度过渡，在减弱动画偏好时会自动降级为本模式。
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
