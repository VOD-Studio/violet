import type { ReactNode } from "react";
import { ALL_NAV_ITEMS } from "../model/navigation";
import { ComponentSpecimens } from "./ComponentSpecimens";
import { DesignPrinciples } from "./DesignPrinciples";
import { DesignSystemLayout } from "./DesignSystemLayout";
import { LayoutSpec } from "./LayoutSpec";
import { MotionCharter } from "./MotionCharter";
import { PaletteGenerator } from "./PaletteGenerator";
import { QuickDecisionTable } from "./QuickDecisionTable";
import { TokenDictionary } from "./TokenDictionary";

/** 章节标识 */
export type ChapterId =
	| "principles"
	| "decisions"
	| "palette"
	| "tokens"
	| "layout"
	| "specimens"
	| "motion";

/** 营造章节元数据兼容接口 */
export interface CodexChapter {
	id: ChapterId;
	num: string;
	name: string;
	scope: string;
	content?: ReactNode;
}

const CONTENT_BY_ID: Record<string, ReactNode> = {
	principles: <DesignPrinciples />,
	decisions: <QuickDecisionTable />,
	palette: <PaletteGenerator />,
	tokens: <TokenDictionary />,
	layout: <LayoutSpec />,
	specimens: <ComponentSpecimens />,
	motion: <MotionCharter />,
};

/**
 * 兼容导出的章节列表，由导航模型推导。
 */
export const CHAPTERS: CodexChapter[] = ALL_NAV_ITEMS.map((item) => ({
	id: item.id as ChapterId,
	num: item.num,
	name: item.title,
	scope: item.scope,
	content: CONTENT_BY_ID[item.id],
}));

/**
 * 营造法式典籍主布局导出。
 */
export function DesignSystemPage() {
	return <DesignSystemLayout />;
}
