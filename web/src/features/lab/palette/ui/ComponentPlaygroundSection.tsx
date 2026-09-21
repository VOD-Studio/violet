import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { Textarea } from "@shared/ui/base/textarea";
import { PhysicalSteps } from "@shared/ui/steps";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { cn } from "@shared/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight, MousePointer, Sparkles } from "lucide-react";
import { useState } from "react";

export interface ComponentPlaygroundSectionProps {
	className?: string;
}

/**
 * ComponentPlaygroundSection - 全站基础组件在紫罗兰主题下的实装交互演练场。
 */
export function ComponentPlaygroundSection({ className }: ComponentPlaygroundSectionProps) {
	const [activeTab, setActiveTab] = useState("buttons");
	const [currentStep, setCurrentStep] = useState(1);

	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Component Variants & Material
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">基础组件主题实装演练</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					验证 Button、Badge、PhysicalSteps、SpotlightCard、古纸排版及选区焦点环在紫罗兰下的质感。
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="mb-6 flex-wrap">
					<TabsTrigger value="buttons">按钮组 Buttons</TabsTrigger>
					<TabsTrigger value="badges">徽章组 Badges</TabsTrigger>
					<TabsTrigger value="timeline">步骤光脉 PhysicalSteps</TabsTrigger>
					<TabsTrigger value="spotlight">聚光与典藏 Spotlight</TabsTrigger>
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

						{/* 公开内容方言对照 */}
						<div className="mt-8 rounded-xl border border-edge-hairline/80 bg-background/50 p-5 dialect-public">
							<div className="mb-2 flex items-center justify-between">
								<span className="font-mono text-xs font-semibold text-brand">
									.dialect-public 方言作用域对照
								</span>
								<span className="font-mono text-[11px] text-muted-foreground">
									--primary → var(--brand)
								</span>
							</div>
							<p className="mb-4 text-xs text-muted-foreground">
								在公开内容方言内，标准 <code className="font-mono">variant="default"</code> 按钮自动继承品牌紫罗兰色：
							</p>
							<div className="flex flex-wrap items-center gap-3">
								<Button variant="default">
									<Sparkles className="size-4" />
									公开主按钮 (Follows Brand)
								</Button>
								<Button variant="outline">公开边框</Button>
								<Button variant="ghost">公开悬停</Button>
							</div>
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

				{/* 物理时间轴 Steps 演练 */}
				<TabsContent value="timeline" className="space-y-6">
					<div className="rounded-2xl border border-edge-hairline bg-card p-6 md:p-8">
						<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
							<div>
								<h4 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
									PhysicalSteps · 物理光脉流转演练
								</h4>
								<p className="mt-1 text-xs text-muted-foreground">
									线条连接与节点依次点亮，激活态呈现紫罗兰色环与柔光微晕。
								</p>
							</div>

							<div className="flex items-center gap-2">
								<Button
									size="xs"
									variant="outline"
									onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
									disabled={currentStep === 0}
								>
									<ChevronLeft className="size-3" />
									上一步
								</Button>
								<Button
									size="xs"
									variant="brand"
									onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
									disabled={currentStep === 3}
								>
									下一步
									<ChevronRight className="size-3" />
								</Button>
							</div>
						</div>

						<div className="max-w-xl py-2">
							<PhysicalSteps
								steps={[
									{ title: "色彩空间数学建模", description: "基于 OKLCH 286° 色相构建均匀感知色阶" },
									{ title: "白瓷与玄曜双重画布", description: "明暗底色消除极端眩光，赋予材质温润感" },
									{ title: "空间表面与光雾层叠", description: "L0 至 L3 渐进式进深，搭配 2.2% 薄雾受光面" },
									{ title: "全域组件与方言交付", description: "按钮、徽章、时间轴与选区光环全面点亮" },
								]}
								current={currentStep}
							/>
						</div>
					</div>
				</TabsContent>

				{/* 聚光与典藏古纸演练 */}
				<TabsContent value="spotlight" className="space-y-6">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						{/* SpotlightCard 聚光测试 */}
						<SpotlightCard className="p-6">
							<div className="flex items-center gap-2 text-xs font-semibold text-brand">
								<MousePointer className="size-4" />
								<span>边缘聚光交互 SpotlightCard</span>
							</div>
							<h5 className="mt-2 text-base font-bold tracking-tight">
								紫罗兰色相响应式游走微光
							</h5>
							<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
								将鼠标在此卡片表面移动：四周将泛起冷香紫罗兰高斯光斑，暗色模式下边框自动点亮冷青内发光。
							</p>
						</SpotlightCard>

						{/* 典藏古纸面展示 */}
						<div
							className="rounded-xl border p-6 shadow-xs"
							style={{
								backgroundColor: "var(--paper)",
								color: "var(--paper-foreground)",
								borderColor: "var(--paper-border)",
							}}
						>
							<div className="flex items-center gap-2 text-xs font-semibold">
								<BookOpen className="size-4" />
								<span>专栏阅读 · 典藏古纸材质</span>
							</div>
							<h5 className="mt-2 text-base font-bold tracking-tight">
								温润如卷 · 长文沉浸排版
							</h5>
							<p className="mt-2 text-xs leading-relaxed opacity-85">
								浅色暖米古籍纸搭配深褐墨字，深色古纸泛暗色微温，有效降低长篇阅读时的眼部疲劳。
							</p>
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

						{/* 焦点环与输入测试 */}
						<div className="space-y-3 rounded-2xl border border-edge-hairline bg-card p-6">
							<h4 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
								Tab 焦点环与输入轮廓
							</h4>
							<input
								type="text"
								placeholder="点击测试输入框 --brand-ring 焦点环..."
								className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
							/>
							<Textarea
								placeholder="点击测试多行文本域选区与焦点轮廓..."
								rows={2}
								className="text-xs"
							/>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</section>
	);
}
