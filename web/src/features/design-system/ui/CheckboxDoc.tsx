import { Checkbox } from "@shared/ui/base/checkbox";
import { Label } from "@shared/ui/base/label";
import { useState } from "react";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { ComponentDemo } from "./ComponentDemo";

const BASIC_CODE = `import { Checkbox } from "@shared/ui/base/checkbox";
import { Label } from "@shared/ui/base/label";
import { useState } from "react";

function Example() {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox
        id="terms"
        checked={checked}
        onCheckedChange={(val) => setChecked(Boolean(val))}
      />
      <Label htmlFor="terms" className="cursor-pointer text-sm font-medium">
        已阅读并同意服务协议（状态：{checked ? "已勾选" : "未勾选"}）
      </Label>
    </div>
  );
}`;

const TRI_STATE_CODE = `import { Checkbox } from "@shared/ui/base/checkbox";
import { Label } from "@shared/ui/base/label";
import { useState } from "react";

const ITEMS = [
  { id: "notify-email", label: "邮件推送通知" },
  { id: "notify-sms", label: "短信安全警报" },
  { id: "notify-browser", label: "浏览器网页通知" },
];

function TriStateDemo() {
  const [selected, setSelected] = useState<string[]>(["notify-email"]);

  const allSelected = selected.length === ITEMS.length;
  const isIndeterminate = selected.length > 0 && !allSelected;

  const handleSelectAll = () => {
    setSelected(allSelected ? [] : ITEMS.map((item) => item.id));
  };

  const handleToggleItem = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-border/70 p-4 space-y-3 bg-card/50">
      <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
        <Checkbox
          id="select-all"
          variant="brand"
          checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
          onCheckedChange={handleSelectAll}
        />
        <Label htmlFor="select-all" className="cursor-pointer font-semibold text-sm">
          全选全部通道 ({selected.length}/{ITEMS.length})
        </Label>
      </div>

      <div className="space-y-2.5 pl-6">
        {ITEMS.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5">
            <Checkbox
              id={item.id}
              variant="brand"
              checked={selected.includes(item.id)}
              onCheckedChange={() => handleToggleItem(item.id)}
            />
            <Label htmlFor={item.id} className="cursor-pointer text-sm text-foreground/90">
              {item.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}`;

const VARIANT_CODE = `<div className="flex flex-wrap items-center gap-6">
  <div className="flex items-center gap-2.5">
    <Checkbox id="var-default" variant="default" defaultChecked />
    <Label htmlFor="var-default">Default 主要语义</Label>
  </div>
  <div className="flex items-center gap-2.5">
    <Checkbox id="var-brand" variant="brand" defaultChecked />
    <Label htmlFor="var-brand">Brand 紫罗兰专属</Label>
  </div>
</div>`;

const SIZE_CODE = `<div className="flex flex-wrap items-center gap-6">
  <div className="flex items-center gap-2">
    <Checkbox id="size-sm" size="sm" defaultChecked />
    <Label htmlFor="size-sm" className="text-xs">小号 sm (14px)</Label>
  </div>
  <div className="flex items-center gap-2.5">
    <Checkbox id="size-default" size="default" defaultChecked />
    <Label htmlFor="size-default" className="text-sm">默认 default (16px)</Label>
  </div>
  <div className="flex items-center gap-3">
    <Checkbox id="size-lg" size="lg" defaultChecked />
    <Label htmlFor="size-lg" className="text-base font-medium">大号 lg (20px)</Label>
  </div>
</div>`;

const DISABLED_CODE = `<div className="flex flex-wrap items-center gap-6">
  <div className="flex items-center gap-2.5">
    <Checkbox id="dis-unchecked" disabled />
    <Label htmlFor="dis-unchecked" className="text-muted-foreground">未选禁用</Label>
  </div>
  <div className="flex items-center gap-2.5">
    <Checkbox id="dis-checked" defaultChecked disabled />
    <Label htmlFor="dis-checked" className="text-muted-foreground">已选禁用</Label>
  </div>
  <div className="flex items-center gap-2.5">
    <Checkbox id="dis-indeterminate" checked="indeterminate" disabled />
    <Label htmlFor="dis-indeterminate" className="text-muted-foreground">半选禁用</Label>
  </div>
</div>`;

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const CHECKBOX_PROPS: PropRow[] = [
	{
		name: "checked",
		type: 'boolean | "indeterminate"',
		defaultValue: "—",
		meaning: "受控勾选状态。传入布尔值表示全选/未选，传入 'indeterminate' 展示减号半选状态。",
	},
	{
		name: "defaultChecked",
		type: 'boolean | "indeterminate"',
		defaultValue: "false",
		meaning: "非受控初始勾选状态。",
	},
	{
		name: "onCheckedChange",
		type: '(checked: boolean | "indeterminate") => void',
		defaultValue: "—",
		meaning: "勾选状态变化回调，点击切换时传递最新布尔状态。",
	},
	{
		name: "variant",
		type: '"default" | "brand"',
		defaultValue: '"default"',
		meaning:
			"视觉变体：default 绑定主要动作语义色（随方言映射），brand 显式绑定 Violet 品牌紫罗兰色。",
	},
	{
		name: "size",
		type: '"sm" | "default" | "lg"',
		defaultValue: '"default"',
		meaning: "尺寸规格：sm 为 14px（表格紧凑行）、default 为 16px、lg 为 20px。",
	},
	{
		name: "disabled",
		type: "boolean",
		defaultValue: "false",
		meaning: "是否禁用；禁用时阻止交互并调低透明度，禁用态背景保持平静。",
	},
	{
		name: "id / name / value",
		type: "string",
		defaultValue: "—",
		meaning: "表单字段关联与原生属性，配对 Label 的 htmlFor 使用。",
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

const ITEMS = [
	{ id: "notify-email", label: "邮件推送通知" },
	{ id: "notify-sms", label: "短信安全警报" },
	{ id: "notify-browser", label: "浏览器网页通知" },
];

/** 以真实 Checkbox 展示用法、三态交互、尺寸规格与无障碍语义边界。 */
export function CheckboxDocPage() {
	const [basicChecked, setBasicChecked] = useState(false);
	const [selected, setSelected] = useState<string[]>(["notify-email"]);

	const allSelected = selected.length === ITEMS.length;
	const isIndeterminate = selected.length > 0 && !allSelected;

	const handleSelectAll = () => {
		setSelected(allSelected ? [] : ITEMS.map((item) => item.id));
	};

	const handleToggleItem = (id: string) => {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
		);
	};

	return (
		<article className="mx-auto w-full max-w-4xl space-y-14 pb-24 font-sans">
			<header className="space-y-3">
				<p className="font-mono text-xs tracking-wider text-muted-foreground">
					表单 / 动作 · Checkbox
				</p>
				<h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
					Checkbox 复选框
				</h1>
				<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
					用于从一组可选项中进行多选，或确认单一独立的二元状态。采用 Violet 语义 Token
					与静穆物理层级打造：顶边细微内高光、纯光学明度吸收反馈（严禁任何位移或缩放颤抖），原生响应
					checked、unchecked 与 indeterminate 三态。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/src/shared/ui/base/checkbox.tsx
					</code>
				</p>
			</header>

			<section aria-labelledby="checkbox-usage" className="space-y-4">
				<h2 id="checkbox-usage" className="text-xl font-bold text-foreground">
					用法
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					与 Label 配合使用，点击复选框或关联文字标签均可无缝切换勾选。
				</p>
				<ComponentDemo code={BASIC_CODE}>
					<div className="flex items-center justify-center">
						<div className="flex items-center gap-2.5">
							<Checkbox
								id="basic-terms"
								checked={basicChecked}
								onCheckedChange={(val) => setBasicChecked(Boolean(val))}
							/>
							<Label
								htmlFor="basic-terms"
								className="cursor-pointer text-sm font-medium select-none"
							>
								已阅读并同意服务协议（状态：{basicChecked ? "已勾选" : "未勾选"}）
							</Label>
						</div>
					</div>
				</ComponentDemo>
			</section>

			<section aria-labelledby="checkbox-examples" className="space-y-12">
				<h2 id="checkbox-examples" className="text-xl font-bold text-foreground">
					按能力选择示例
				</h2>

				{/* 三态联动演练 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">
						全选与半选联动 (Tri-state / Indeterminate)
					</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						在表格批量操作或复合权限树中，当子项仅部分被勾选时，父级复选框自动进入
						indeterminate
						状态，呈现减号指示器；再次点击父级可统一全选或全部反选。下方为完整联动实况：
					</p>
					<ComponentDemo code={TRI_STATE_CODE}>
						<div className="flex justify-center">
							<div className="w-full max-w-sm space-y-3 rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
								<div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
									<Checkbox
										id="select-all"
										variant="brand"
										checked={
											allSelected
												? true
												: isIndeterminate
													? "indeterminate"
													: false
										}
										onCheckedChange={handleSelectAll}
									/>
									<Label
										htmlFor="select-all"
										className="cursor-pointer text-sm font-semibold select-none"
									>
										全选全部通知通道 ({selected.length}/{ITEMS.length})
									</Label>
								</div>

								<div className="space-y-2.5 pl-6">
									{ITEMS.map((item) => (
										<div key={item.id} className="flex items-center gap-2.5">
											<Checkbox
												id={item.id}
												variant="brand"
												checked={selected.includes(item.id)}
												onCheckedChange={() => handleToggleItem(item.id)}
											/>
											<Label
												htmlFor={item.id}
												className="cursor-pointer text-sm text-foreground/90 select-none"
											>
												{item.label}
											</Label>
										</div>
									))}
								</div>
							</div>
						</div>
					</ComponentDemo>
				</div>

				{/* 视觉变体 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">视觉变体 (Variants)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						default 变体使用 primary 主要语义色，随页面所在方言自动映射；brand
						变体显式绑定冷香紫罗兰高光，适合品牌专属选项。
					</p>
					<ComponentDemo code={VARIANT_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-8">
							<div className="flex items-center gap-2.5">
								<Checkbox id="demo-var-default" variant="default" defaultChecked />
								<Label
									htmlFor="demo-var-default"
									className="cursor-pointer select-none"
								>
									Default 主要动作
								</Label>
							</div>
							<div className="flex items-center gap-2.5">
								<Checkbox id="demo-var-brand" variant="brand" defaultChecked />
								<Label
									htmlFor="demo-var-brand"
									className="cursor-pointer select-none"
								>
									Brand 紫罗兰专属
								</Label>
							</div>
						</div>
					</ComponentDemo>
				</div>

				{/* 尺寸梯度 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">尺寸规格 (Sizes)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						涵盖 sm (14px)、default (16px) 与 lg
						(20px)；小号推荐用于数据表格行，大号用于醒目卡片或移动端大点击区域。
					</p>
					<ComponentDemo code={SIZE_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-8">
							<div className="flex items-center gap-2">
								<Checkbox id="demo-size-sm" size="sm" defaultChecked />
								<Label
									htmlFor="demo-size-sm"
									className="cursor-pointer text-xs select-none"
								>
									小号 sm (14px)
								</Label>
							</div>
							<div className="flex items-center gap-2.5">
								<Checkbox id="demo-size-default" size="default" defaultChecked />
								<Label
									htmlFor="demo-size-default"
									className="cursor-pointer text-sm select-none"
								>
									默认 default (16px)
								</Label>
							</div>
							<div className="flex items-center gap-3">
								<Checkbox id="demo-size-lg" size="lg" defaultChecked />
								<Label
									htmlFor="demo-size-lg"
									className="cursor-pointer text-base font-medium select-none"
								>
									大号 lg (20px)
								</Label>
							</div>
						</div>
					</ComponentDemo>
				</div>

				{/* 禁用状态 */}
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-foreground">禁用状态 (Disabled)</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						禁用时透明度自然降低，阻止鼠标光标与键盘聚焦交互。
					</p>
					<ComponentDemo code={DISABLED_CODE}>
						<div className="flex flex-wrap items-center justify-center gap-8">
							<div className="flex items-center gap-2.5">
								<Checkbox id="demo-dis-unchecked" disabled />
								<Label
									htmlFor="demo-dis-unchecked"
									className="text-muted-foreground"
								>
									未选禁用
								</Label>
							</div>
							<div className="flex items-center gap-2.5">
								<Checkbox id="demo-dis-checked" defaultChecked disabled />
								<Label htmlFor="demo-dis-checked" className="text-muted-foreground">
									已选禁用
								</Label>
							</div>
							<div className="flex items-center gap-2.5">
								<Checkbox
									id="demo-dis-indeterminate"
									checked="indeterminate"
									disabled
								/>
								<Label
									htmlFor="demo-dis-indeterminate"
									className="text-muted-foreground"
								>
									半选禁用
								</Label>
							</div>
						</div>
					</ComponentDemo>
				</div>
			</section>

			<section aria-labelledby="checkbox-api" className="space-y-4">
				<h2 id="checkbox-api" className="text-xl font-bold text-foreground">
					API 参考
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					基于 Radix Checkbox Primitive，完整继承所有标准属性与事件。
				</p>
				<ApiTable
					title="Checkbox Props"
					columns={PROP_COLUMNS}
					rows={CHECKBOX_PROPS}
					rowKey={(row) => row.name}
				/>
			</section>

			<section aria-labelledby="checkbox-guidance" className="space-y-4">
				<h2 id="checkbox-guidance" className="text-xl font-bold text-foreground">
					使用边界
				</h2>
				<ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					<li className="border-l-2 border-border pl-4">
						无关联独立文本的复选框（例如数据表格的第一列选择框），必须显式配置
						aria-label 以满足屏幕阅读器可访问性。
					</li>
					<li className="border-l-2 border-border pl-4">
						在包含批量子项的父级控制器上，必须准确推导 indeterminate
						三态值，避免子项部分选中时给用户造成「已全选」的假象。
					</li>
					<li className="border-l-2 border-border pl-4">
						复选框内部的勾选与取消勾选动效采用纯色彩与透明度微光过渡，严禁在外部叠加
						scale 缩放动效。
					</li>
				</ul>
			</section>
		</article>
	);
}
