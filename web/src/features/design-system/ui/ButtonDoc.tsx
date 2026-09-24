import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Plus } from "lucide-react";
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
<Button type="button" variant="secondary">次要动作</Button>
<Button type="button" variant="outline">描边动作</Button>
<Button type="button" variant="ghost">轻量动作</Button>
<Button type="button" variant="link">文字动作</Button>
<Button type="button" variant="brand">品牌动作</Button>
<Button type="button" variant="destructive">危险动作</Button>`;

const SIZE_CODE = `import { Plus } from "lucide-react";

<Button type="button" size="xs">极小</Button>
<Button type="button" size="sm">小</Button>
<Button type="button" size="default">默认</Button>
<Button type="button" size="lg">大</Button>
<Button type="button" size="icon" aria-label="新建">
  <Plus aria-hidden="true" />
</Button>`;

const STATE_CODE = `import { Loader2 } from "lucide-react";

<Button type="button" disabled>不可用</Button>
<Button type="button" disabled aria-busy="true">
  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
  处理中…
</Button>`;

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
		type: "default | destructive | outline | secondary | ghost | brand | link",
		defaultValue: "default",
		meaning: "动作的视觉层级。主要动作随页面方言变化；brand 固定使用品牌色。",
	},
	{
		name: "size",
		type: "default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg",
		defaultValue: "default",
		meaning: "高度与内边距；纯图标按钮使用 icon 档位并提供可访问名称。",
	},
	{
		name: "asChild",
		type: "boolean",
		defaultValue: "false",
		meaning: "把样式与属性赋予唯一子元素；导航场景传入 Link。",
	},
	{
		name: "disabled",
		type: "boolean",
		defaultValue: "false",
		meaning: "原生 button 的禁用状态；链接没有对应的原生 disabled 语义。",
	},
	{
		name: "type",
		type: "button | submit | reset",
		defaultValue: "浏览器原生值",
		meaning: "继承原生 button 属性；表单内的非提交动作应显式设为 button。",
	},
	{
		name: "onClick / className",
		type: "原生 button 属性",
		defaultValue: "—",
		meaning: "事件回调与布局类名可透传；不要用 className 覆盖 variant 的颜色语义。",
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
		label: "何时使用",
		headerClassName: "min-w-56",
		cellClassName: "text-muted-foreground leading-relaxed",
		render: (row) => row.meaning,
	},
];

/** 以真实 Button 展示用法、视觉层级、状态和语义边界。 */
export function ButtonDocPage() {
	const [clicks, setClicks] = useState(0);

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
					触发操作时用按钮，导航时用链接。展示本站的动作层级、尺寸和状态；
					加载状态由调用方组合，不是组件内置属性。
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
					从项目公共组件导入。下方按钮是可操作的，代码与预览使用同一个状态更新方式。
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
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">视觉层级</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						一个区域只给主要动作最高强调。危险操作使用
						destructive；需要明确品牌露出时才用 brand，普通主要操作用 default。
					</p>
					<ComponentDemo code={VARIANT_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button" variant="default">
								主要动作
							</Button>
							<Button type="button" variant="secondary">
								次要动作
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
							<Button type="button" variant="brand">
								品牌动作
							</Button>
							<Button type="button" variant="destructive">
								危险动作
							</Button>
						</div>
					</ComponentDemo>
				</div>

				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">尺寸与图标</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						纯图标按钮必须提供 aria-label；图标本身为装饰，不重复朗读。
					</p>
					<ComponentDemo code={SIZE_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button" size="xs">
								极小
							</Button>
							<Button type="button" size="sm">
								小
							</Button>
							<Button type="button" size="default">
								默认
							</Button>
							<Button type="button" size="lg">
								大
							</Button>
							<Button type="button" size="icon" aria-label="新建">
								<Plus aria-hidden="true" />
							</Button>
						</div>
					</ComponentDemo>
				</div>

				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">不可用与处理中</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						组件没有 isLoading 属性。提交期间由调用方传入 disabled、状态文案和加载图标。
					</p>
					<ComponentDemo code={STATE_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button" disabled>
								不可用
							</Button>
							<Button type="button" disabled aria-busy="true">
								<Loader2 aria-hidden="true" className="size-4 animate-spin" />
								处理中…
							</Button>
						</div>
					</ComponentDemo>
				</div>

				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">作为导航链接</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						跳转页面使用 Link；asChild
						只复用按钮外观，不改变链接语义。试着用键盘聚焦并打开它。
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
					下表只列本站 Button 的特殊属性与影响语义的原生属性；其余 HTML button
					属性保持原生行为。
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
						键盘用户应能通过 Tab 定位，并看到焦点描边；不要用 className 清掉
						focus-visible 样式。
					</li>
					<li className="border-l-2 border-border pl-4">
						表单内的非提交按钮明确设置 type="button"；提交按钮才用 type="submit"。
					</li>
					<li className="border-l-2 border-border pl-4">
						asChild 包裹链接时不要依赖 disabled
						禁止跳转；在调用方移除链接或改用原生按钮。
					</li>
				</ul>
			</section>
		</article>
	);
}
