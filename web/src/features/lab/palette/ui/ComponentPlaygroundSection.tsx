import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { cn } from "@shared/lib/utils";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export interface ComponentPlaygroundSectionProps {
	className?: string;
}

/**
 * ComponentPlaygroundSection - 全站基础组件在紫罗兰主题下的实装交互演练场。
 */
export function ComponentPlaygroundSection({ className }: ComponentPlaygroundSectionProps) {
	const [activeTab, setActiveTab] = useState("buttons");

	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Component Variants
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">基础组件主题实装演练</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					验证 Button、Badge、Tabs、输入焦点环与全局 ::selection
					文本高亮在冷香紫罗兰下的真实质感。
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="mb-6">
					<TabsTrigger value="buttons">按钮组 Buttons</TabsTrigger>
					<TabsTrigger value="badges">徽章组 Badges</TabsTrigger>
					<TabsTrigger value="interactive">交互焦点 & 选区</TabsTrigger>
				</TabsList>

				{/* 按钮变体演练 */}
				<TabsContent value="buttons" className="space-y-6">
					<div className="rounded-2xl border border-edge-hairline bg-card p-6 md:p-8">
						<h4 className="mb-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
							Button 变体阶梯
						</h4>

						<div className="flex flex-wrap items-center gap-3">
							<Button variant="brand">
								<Sparkles className="size-4" />
								品牌主动作 (Brand)
							</Button>

							<Button variant="default">默认主操作 (Default)</Button>
							<Button variant="secondary">次级操作 (Secondary)</Button>
							<Button variant="outline">边框轮廓 (Outline)</Button>
							<Button variant="ghost">幽灵悬停 (Ghost)</Button>
							<Button variant="destructive">危险操作 (Destructive)</Button>
						</div>

						<div className="mt-6 border-t border-edge-hairline/60 pt-4">
							<span className="text-xs text-muted-foreground">
								说明：<code className="font-mono text-brand">variant="brand"</code>{" "}
								采用皇家鸢尾紫与星空紫水晶，hover 加深/微发光并伴随阴影扩散。
							</span>
						</div>
					</div>
				</TabsContent>

				{/* 徽章变体演练 */}
				<TabsContent value="badges" className="space-y-6">
					<div className="rounded-2xl border border-edge-hairline bg-card p-6 md:p-8">
						<h4 className="mb-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
							Badge 徽章体系
						</h4>

						<div className="flex flex-wrap items-center gap-3">
							<Badge variant="brand">
								<Sparkles className="size-3" />
								品牌薄雾 (Brand Wash)
							</Badge>

							<Badge variant="default">默认深色 (Default)</Badge>
							<Badge variant="secondary">中性次级 (Secondary)</Badge>
							<Badge variant="outline">发丝边框 (Outline)</Badge>
							<Badge variant="destructive">阻断警告 (Destructive)</Badge>
						</div>

						<div className="mt-6 border-t border-edge-hairline/60 pt-4">
							<span className="text-xs text-muted-foreground">
								说明：<code className="font-mono text-brand">variant="brand"</code>{" "}
								使用低占比的 <code className="font-mono">--brand-wash</code>{" "}
								薄雾底色与深紫罗兰墨字，契合安静生长的设计哲学。
							</span>
						</div>
					</div>
				</TabsContent>

				{/* 选区与焦点环体验 */}
				<TabsContent value="interactive" className="space-y-6">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						{/* 选区文本测试 */}
						<div className="rounded-2xl border border-edge-hairline bg-card p-6">
							<h4 className="mb-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
								::selection 选区紫罗兰微光体验
							</h4>
							<p className="text-sm leading-relaxed select-all">
								拖动鼠标选中这段文字：全站已配置全局柔和紫罗兰高亮选区（::selection
								绑定 --brand 与
								--brand-foreground），在浅色白瓷与深色玄曜下均能呈现丝滑冷香触感。
							</p>
						</div>

						{/* 焦点环测试 */}
						<div className="rounded-2xl border border-edge-hairline bg-card p-6">
							<h4 className="mb-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
								Tab 焦点环与输入轮廓
							</h4>
							<input
								type="text"
								placeholder="点击此处测试 --brand-ring 焦点环..."
								className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
							/>
							<p className="mt-2 text-xs text-muted-foreground">
								聚焦环继承 Violet 286° 色相，柔和扩散
								3px，兼顾无障碍聚焦提示与视觉温润。
							</p>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</section>
	);
}
