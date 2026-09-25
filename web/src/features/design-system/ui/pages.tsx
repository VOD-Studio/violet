import { DesignPrinciples } from "./DesignPrinciples";
import { DesignSystemDocHeader } from "./DesignSystemDocHeader";
import { LayoutSpec } from "./LayoutSpec";
import { MotionCharter } from "./MotionCharter";
import { PaletteGenerator } from "./PaletteGenerator";
import { QuickDecisionTable } from "./QuickDecisionTable";
import { SpecimensIndex } from "./SpecimensIndex";
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
 * 柒 · 组件目录子页
 */
export function SpecimensPage() {
	return <SpecimensIndex />;
}
