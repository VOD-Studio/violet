import {
	ComponentSpecimens,
	SpecimensButtons,
	SpecimensFeedback,
	SpecimensStatus,
} from "./ComponentSpecimens";
import { DesignPrinciples } from "./DesignPrinciples";
import { DesignSystemDocHeader } from "./DesignSystemDocHeader";
import { LayoutSpec } from "./LayoutSpec";
import { MotionCharter } from "./MotionCharter";
import { PaletteGenerator } from "./PaletteGenerator";
import { QuickDecisionTable } from "./QuickDecisionTable";
import { TokenDictionary } from "./TokenDictionary";

/**
 * 壹 · 设计原则子页
 */
export function PrinciplesPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="壹"
				title="设计原则"
				scope="查表无果时回退的最高判据，与贯穿全站的底线。"
			/>
			<DesignPrinciples />
		</div>
	);
}

/**
 * 贰 · 快速决策表子页
 */
export function DecisionsPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="贰"
				title="快速决策表"
				scope="不知道该用哪个 token 时，先查这张表。表里没有的，回到基本原则。"
			/>
			<QuickDecisionTable />
		</div>
	);
}

/**
 * 叁 · 色板生成器子页
 */
export function PalettePage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="叁"
				title="色板生成器"
				scope="以单一主色为种，推演全域色阶、语义角色与中性基准。"
			/>
			<PaletteGenerator />
		</div>
	);
}

/**
 * 肆 · Token 词典子页
 */
export function TokensPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="肆"
				title="Token 词典"
				scope="品牌色、功能色、中性色、语义色——全部语义 token 的名称与实时值。"
			/>
			<TokenDictionary />
		</div>
	);
}

/**
 * 伍 · 布局规格子页
 */
export function LayoutPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="伍"
				title="布局规格"
				scope="间距、圆角、投影与容器的法定刻度。"
			/>
			<LayoutSpec />
		</div>
	);
}

/**
 * 陆 · 动效章程子页
 */
export function MotionPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="陆"
				title="动效章程"
				scope="运动的时间、幅度与克制的事由。"
			/>
			<MotionCharter />
		</div>
	);
}

/**
 * 柒 · 组件活样例子页（全量）
 */
export function SpecimensPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="柒"
				title="组件活样例"
				scope="真实控件活体陈列，样例即真相。"
			/>
			<ComponentSpecimens />
		</div>
	);
}

/**
 * 柒.1 · 按钮与控件子页
 */
export function SpecimensButtonsPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="柒 · 壹"
				title="按钮与控件"
				scope="主要动作、次要动作、危险动作与尺寸规格。"
			/>
			<div className="mt-8 rounded-2xl border border-border/40 bg-card/50 p-6">
				<SpecimensButtons />
			</div>
		</div>
	);
}

/**
 * 柒.2 · 徽章与状态子页
 */
export function SpecimensStatusPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="柒 · 贰"
				title="徽标与状态"
				scope="状态标签、语义色阶微章与骨架占位态。"
			/>
			<div className="mt-8 rounded-2xl border border-border/40 bg-card/50 p-6">
				<SpecimensStatus />
			</div>
		</div>
	);
}

/**
 * 柒.3 · 输入与交互子页
 */
export function SpecimensFeedbackPage() {
	return (
		<div className="space-y-6">
			<DesignSystemDocHeader
				num="柒 · 叁"
				title="输入与交互"
				scope="单行输入、多行文本域与物理开关控件。"
			/>
			<div className="mt-8 rounded-2xl border border-border/40 bg-card/50 p-6">
				<SpecimensFeedback />
			</div>
		</div>
	);
}
