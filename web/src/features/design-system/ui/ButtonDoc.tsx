import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Mail, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { ComponentDemo } from "./ComponentDemo";

const BASIC_CODE = `import { Button } from "@shared/ui/base/button";
import { useState } from "react";

function Example() {
  const [clicks, setClicks] = useState(0);
  return (
    <Button type="button" onClick={() => setClicks((count) => count + 1)}>
      已点击 {clicks} 次
    </Button>
  );
}`;

const VARIANT_CODE = `<Button type="button" variant="default">主要动作</Button>
<Button type="button" variant="brand">品牌强调</Button>
<Button type="button" variant="secondary">次要动作</Button>
<Button type="button" variant="soft">柔和淡染</Button>
<Button type="button" variant="outline">描边动作</Button>
<Button type="button" variant="ghost">轻量动作</Button>
<Button type="button" variant="link">文字动作</Button>
<Button type="button" variant="destructive">危险操作</Button>`;

const SIZE_CODE = `import { Plus } from "lucide-react";

<Button type="button" size="xs">极小 xs</Button>
<Button type="button" size="sm">小 sm</Button>
<Button type="button" size="default">默认</Button>
<Button type="button" size="lg">大 lg</Button>
<Button type="button" size="xl">特大 xl</Button>
<Button type="button" size="icon" aria-label="新建">
  <Plus aria-hidden="true" />
</Button>`;

const ICON_CODE = `import { ArrowRight, Download, Mail, Sparkles } from "lucide-react";

<Button leftIcon={<Mail />}>发送邮件</Button>
<Button rightIcon={<ArrowRight />} variant="brand">继续阅读</Button>
<Button leftIcon={<Sparkles />} variant="soft">灵感启发</Button>
<Button leftIcon={<Download />} rightIcon={<ArrowRight />} variant="outline">导出数据</Button>`;

const STATE_CODE = `import { Button } from "@shared/ui/base/button";
import { Mail } from "lucide-react";

{/* 1. 内置加载中状态（自动禁用并展示平滑指示器，杜绝宽度跳动） */}
<Button loading>保存修改</Button>

{/* 2. 携带自定义文案的加载状态 */}
<Button loading loadingText="正在同步数据...">提交发布</Button>

{/* 3. 前置图标平滑切换：leftIcon 在加载时自动替换为加载指示器 */}
<Button loading leftIcon={<Mail />}>发送邮件</Button>

{/* 4. 原生不可用状态 */}
<Button disabled>已归档</Button>`;

const LINK_CODE = `import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

<Button asChild variant="outline">
  <Link to="/design-system/decisions">
    查看快速决策表 <ArrowRight aria-hidden="true" />
  </Link>
</Button>`;

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const BUTTON_PROPS: PropRow[] = [
	{
		name: "variant",
		type: '"default" | "brand" | "secondary" | "soft" | "outline" | "ghost" | "link" | "destructive"',
		defaultValue: '"default"',
		meaning: "视觉层级变体，严格绑定 Violet 语义 Token（primary / brand / secondary 等）。",
	},
	{
		name: "size",
		type: '"default" | "xs" | "sm" | "lg" | "xl" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"',
		defaultValue: '"default"',
		meaning: "高度与内外边距规格；纯图标按钮使用 icon 档位并提供 aria-label。",
	},
	{
		name: "loading",
		type: "boolean",
		defaultValue: "false",
		meaning: "内置加载中状态；自动禁用、打上 aria-busy 并平滑替换前置图标或展示指示器。",
	},
	{
		name: "loadingText",
		type: "ReactNode",
		defaultValue: "—",
		meaning:
			"处于 loading 态时展示的文案；提供时替换正文，省略时保留正文并在前置位展示旋转动画。",
	},
	{
		name: "leftIcon",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "按钮前置图标插槽；加载时平滑替换为加载指示器以杜绝页面布局跳变。",
	},
	{
		name: "rightIcon",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "按钮后置图标插槽。",
	},
	{
		name: "asChild",
		type: "boolean",
		defaultValue: "false",
		meaning: "基于 Radix Slot 将样式与属性赋予唯一子元素；导航跳转场景传入 Link。",
	},
	{
		name: "disabled",
		type: "boolean",
		defaultValue: "false",
		meaning: "原生 button 禁用属性；同时阻止 active 物理微沉与点击事件。",
	},
	{
		name: "type",
		type: '"button" | "submit" | "reset"',
		defaultValue: '"button"',
		meaning: "原生 button 类型；默认为安全防触发表单提交的 button 类型。",
	},
	{
		name: "onClick / className",
		type: "原生 button 属性",
		defaultValue: "—",
		meaning: "标准事件回调与额外布局类名；严禁通过 className 覆盖 variant 的颜色语义。",
	},
];

const PROP_COLUMNS: ApiTableColumn<PropRow>[] = [
	{
		label: "属性",
		headerClassName: "min-w-28",
		cellClassName: "font-mono text-foreground",
		render: (row) => row.name,
	},
	{
		label: "类型",
		headerClassName: "min-w-56",
		cellClassName: "font-mono text-muted-foreground",
		render: (row) => row.type,
	},
	{ label: "默认值", headerClassName: "min-w-28", render: (row) => row.defaultValue },
	{
		label: "说明与约束",
		headerClassName: "min-w-56",
		cellClassName: "text-muted-foreground leading-relaxed",
		render: (row) => row.meaning,
	},
];

/** 以真实 Button 展示用法、视觉层级、状态和语义边界。 */
export function ButtonDocPage() {
	const [clicks, setClicks] = useState(0);
	const [simulating, setSimulating] = useState(false);

	const handleSimulateLoading = () => {
		setSimulating(true);
		window.setTimeout(() => setSimulating(false), 2000);
	};

	return (
		<article className="mx-auto w-full max-w-4xl space-y-14 pb-24 font-sans">
			<header className="space-y-3">
				<p className="font-mono text-xs tracking-wider text-muted-foreground">
					动作 · Button
				</p>
				<h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
					Button 按钮
				</h1>
				<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
					触发操作时用按钮，导航时用链接。基于 Violet 语义 Token
					与精工物理层级打造：顶边细微内高光与底部轻触感阴影、自然的按压微沉触觉、内置平滑加载（杜绝布局抖动）与首选图标插槽。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/src/shared/ui/base/button.tsx
					</code>
				</p>
			</header>

			<section aria-labelledby="button-usage" className="space-y-4">
				<h2 id="button-usage" className="text-xl font-bold text-foreground">
					用法
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					从项目公共组件导入。下方按钮是可操作的，点击可体验按压微沉手感与状态计数。
				</p>
				<ComponentDemo code={BASIC_CODE}>
					<div className="flex justify-center">
						<Button type="button" onClick={() => setClicks((count) => count + 1)}>
							已点击 {clicks} 次
						</Button>
					</div>
				</ComponentDemo>
			</section>

			<section aria-labelledby="button-examples" className="space-y-12">
				<h2 id="button-examples" className="text-xl font-bold text-foreground">
					按能力选择示例
				</h2>

				{/* 视觉层级 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">视觉层级 (Variants)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						主要动作使用 default（随方言映射），品牌强调使用专属 brand，柔和辅助使用
						soft，描边与次级使用 outline / secondary，轻量操作使用 ghost。
					</p>
					<ComponentDemo code={VARIANT_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button" variant="default">
								主要动作
							</Button>
							<Button type="button" variant="brand">
								品牌强调
							</Button>
							<Button type="button" variant="secondary">
								次要动作
							</Button>
							<Button type="button" variant="soft">
								柔和淡染
							</Button>
							<Button type="button" variant="outline">
								描边动作
							</Button>
							<Button type="button" variant="ghost">
								轻量动作
							</Button>
							<Button type="button" variant="link">
								文字动作
							</Button>
							<Button type="button" variant="destructive">
								危险操作
							</Button>
						</div>
					</ComponentDemo>
				</div>

				{/* 尺寸规格 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">尺寸规格 (Sizes)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						包含 xs 到 xl 五个高度梯度；纯图标按钮请使用 icon 档位并提供明确的
						aria-label。
					</p>
					<ComponentDemo code={SIZE_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button" size="xs">
								极小 xs
							</Button>
							<Button type="button" size="sm">
								小 sm
							</Button>
							<Button type="button" size="default">
								默认
							</Button>
							<Button type="button" size="lg">
								大 lg
							</Button>
							<Button type="button" size="xl">
								特大 xl
							</Button>
							<Button type="button" size="icon" aria-label="新建">
								<Plus aria-hidden="true" />
							</Button>
						</div>
					</ComponentDemo>
				</div>

				{/* 图标扩展 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">图标插槽 (Icons)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						原生支持 leftIcon 与 rightIcon 传参，间距与缩放按按钮尺寸自动协调。
					</p>
					<ComponentDemo code={ICON_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button leftIcon={<Mail aria-hidden="true" />}>发送邮件</Button>
							<Button rightIcon={<ArrowRight aria-hidden="true" />} variant="brand">
								继续阅读
							</Button>
							<Button leftIcon={<Sparkles aria-hidden="true" />} variant="soft">
								灵感启发
							</Button>
							<Button
								leftIcon={<Download aria-hidden="true" />}
								rightIcon={<ArrowRight aria-hidden="true" />}
								variant="outline"
							>
								导出数据
							</Button>
						</div>
					</ComponentDemo>
				</div>

				{/* 状态与加载 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">状态与加载 (Loading)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						内置 loading 支持：处于加载中时自动禁用并设置
						aria-busy；前置图标平滑切换为指示器，杜绝页面宽度抖动。
					</p>
					<ComponentDemo code={STATE_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button
								type="button"
								variant="brand"
								loading={simulating}
								onClick={handleSimulateLoading}
							>
								{simulating ? "正在处理…" : "点击体验加载"}
							</Button>
							<Button
								type="button"
								variant="default"
								loading
								loadingText="正在同步数据..."
							>
								提交发布
							</Button>
							<Button
								type="button"
								variant="outline"
								loading
								leftIcon={<Mail aria-hidden="true" />}
							>
								发送邮件
							</Button>
							<Button type="button" disabled>
								已归档
							</Button>
						</div>
					</ComponentDemo>
				</div>

				{/* 链接模式 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">
						作为导航链接 (asChild)
					</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						跳转页面使用 Link；asChild
						只复用按钮外观与物理触感，不改变链接语义与无障碍树结构。
					</p>
					<ComponentDemo code={LINK_CODE}>
						<div className="flex justify-center">
							<Button asChild variant="outline">
								<Link to="/design-system/decisions">
									查看快速决策表 <ArrowRight aria-hidden="true" />
								</Link>
							</Button>
						</div>
					</ComponentDemo>
				</div>
			</section>

			<section aria-labelledby="button-api" className="space-y-4">
				<h2 id="button-api" className="text-xl font-bold text-foreground">
					API 参考
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					下表列出 Button 扩展属性与关键语义定义；其余标准 HTML button 属性均完全支持。
				</p>
				<ApiTable
					title="Button Props"
					columns={PROP_COLUMNS}
					rows={BUTTON_PROPS}
					rowKey={(row) => row.name}
				/>
			</section>

			<section aria-labelledby="button-guidance" className="space-y-4">
				<h2 id="button-guidance" className="text-xl font-bold text-foreground">
					使用边界
				</h2>
				<ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					<li className="border-l-2 border-border pl-4">
						键盘用户通过 Tab 定位时呈现高对比度聚焦描边；严禁使用 className 抹除
						focus-visible 样式。
					</li>
					<li className="border-l-2 border-border pl-4">
						Button 默认 type="button"，表单内主提交操作请显式设置 type="submit"。
					</li>
					<li className="border-l-2 border-border pl-4">
						asChild 包裹链接时不应传 disabled 禁止跳转；应由调用方在 JSX
						逻辑中条件渲染纯文本或原生按钮。
					</li>
				</ul>
			</section>
		</article>
	);
}
