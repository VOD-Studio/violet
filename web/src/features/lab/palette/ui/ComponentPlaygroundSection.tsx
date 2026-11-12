import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import {
	Badge,
	Button,
	Input,
	iconProps,
	Steps,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
} from "@violet/ui";
import { cn } from "cn";
import { BookOpen, ChevronLeft, ChevronRight, MousePointer } from "lucide-react";
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
					验证 Button、Badge、Steps、SpotlightCard、古纸排版及选区焦点环在紫罗兰下的质感。
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="mb-6">
					<TabsTrigger value="buttons">按钮组 Buttons</TabsTrigger>
					<TabsTrigger value="badges">徽章组 Badges</TabsTrigger>
					<TabsTrigger value="timeline">步骤 Steps</TabsTrigger>
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
							<Button variant="primary">默认主操作 (Default)</Button>
							<Button variant="secondary">次级操作 (Secondary)</Button>
							<Button variant="outline">边框轮廓 (Outline)</Button>
							<Button variant="ghost">幽灵悬停 (Ghost)</Button>
							<Button variant="destructive">危险操作 (Destructive)</Button>
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
							<Badge tone="ok">正常 (ok)</Badge>
							<Badge tone="neutral">草稿 (neutral)</Badge>
							<Badge tone="accent">已定时 (accent)</Badge>
							<Badge tone="warning">待审 (warning)</Badge>
							<Badge tone="off">已停用 (off)</Badge>
							<Badge tone="danger">异常 (danger)</Badge>
						</div>
					</div>
				</TabsContent>

				{/* 步骤流程演练 */}
				<TabsContent value="timeline" className="space-y-6">
					<div className="rounded-2xl border border-edge-hairline bg-card p-6 md:p-8">
						<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
							<div>
								<h4 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
									Steps · 流程演练
								</h4>
								<p className="mt-1 text-xs text-muted-foreground">
									已完成打勾、当前一步墨色实心；连接线只画到走过的位置，已完成的步骤可以点回去。
								</p>
							</div>

							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
									disabled={currentStep === 0}
								>
									<ChevronLeft {...iconProps(12)} />
									上一步
								</Button>
								<Button
									size="sm"
									variant="primary"
									onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
									disabled={currentStep === 3}
								>
									下一步
									<ChevronRight {...iconProps(12)} />
								</Button>
							</div>
						</div>

						<div className="max-w-xl py-2">
							<Steps
								orientation="vertical"
								onStepClick={setCurrentStep}
								steps={[
									{
										title: "色彩空间数学建模",
										description: "基于 OKLCH 286° 色相构建均匀感知色阶",
									},
									{
										title: "白瓷与玄曜双重画布",
										description: "明暗底色消除极端眩光，赋予材质温润感",
									},
									{
										title: "空间表面与光雾层叠",
										description: "L0 至 L3 渐进式进深，搭配 2.2% 薄雾受光面",
									},
									{
										title: "全域组件与方言交付",
										description: "按钮、徽章、时间轴与选区光环全面点亮",
									},
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
							<div className="flex items-center gap-2 text-xs font-semibold text-primary-base">
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
								拖动鼠标选中这段文字：实验室局部选区使用柔和紫罗兰高亮（::selection
								绑定
								--primary-base），仅在实验稿作用域内保留浅色白瓷与深色玄曜的外观。
							</p>
						</div>

						{/* 焦点环与输入测试 */}
						<div className="space-y-3 rounded-2xl border border-edge-hairline bg-card p-6">
							<h4 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
								Tab 焦点环与输入轮廓
							</h4>
							<Input
								aria-label="焦点轮廓演练"
								placeholder="点击体验 Input 聚焦反馈"
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
