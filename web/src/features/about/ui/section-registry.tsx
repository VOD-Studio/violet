import type { ComponentType } from "react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";
import { AvatarTaglineSection } from "./AvatarTaglineSection";
import { BioSection } from "./BioSection";
import { ChangelogSection } from "./ChangelogSection";
import { HeroSection } from "./HeroSection";
import { LiveStatsSection } from "./LiveStatsSection";
import { ProfileCardSection } from "./ProfileCardSection";
import { SkillsSection } from "./SkillsSection";
import { SocialMatrixSection } from "./SocialMatrixSection";

/**
 * ABOUT_SECTION_IDS - 关于页区块标识常量
 *
 * 后台配置页与前台注册表共用，保证 id 一致。
 */
export const ABOUT_SECTION_IDS = [
	"hero", // Hero 区（站点名/描述）
	"avatar_tagline", // 头像 + 标语
	"bio", // 个人简介
	"profile_card", // 名片卡
	"skills", // 技能/兴趣标签云（三组）
	"social_matrix", // 社交矩阵
	"live_stats", // 站点生命体征
	"changelog", // 更新日志
] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

/** 区块 id → 中文显示名（后台配置页用） */
export const ABOUT_SECTION_LABELS: Record<string, string> = {
	hero: "Hero 区（站点名/描述）",
	avatar_tagline: "头像 + 标语",
	bio: "个人简介",
	profile_card: "名片卡",
	skills: "技能/兴趣标签云（三组）",
	social_matrix: "社交矩阵",
	live_stats: "站点生命体征",
	changelog: "更新日志",
};

/**
 * 区块注册表 - section id → 渲染组件
 *
 * 所有保留区块均有真实组件，无占位。未知 id（历史配置残留）返回 null 不渲染，
 * 避免「开了区块却显示虚线占位框」的问题。
 */
const registry: Record<string, ComponentType<AboutSectionProps>> = {
	hero: HeroSection,
	avatar_tagline: AvatarTaglineSection,
	bio: BioSection,
	profile_card: ProfileCardSection,
	skills: SkillsSection,
	social_matrix: SocialMatrixSection,
	live_stats: LiveStatsSection,
	changelog: ChangelogSection,
};

/** 取某区块的渲染组件；未注册的 id 返回 null（不渲染占位） */
export function resolveSectionComponent(id: string): ComponentType<AboutSectionProps> | null {
	return registry[id] ?? null;
}
