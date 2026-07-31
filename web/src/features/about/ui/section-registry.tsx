import type { ComponentType } from "react";
import { AboutSectionPlaceholder, type AboutSectionProps } from "./AboutSectionPlaceholder";
import { AvatarTaglineSection } from "./AvatarTaglineSection";
import { ProfileCardSection } from "./ProfileCardSection";
import { SkillsSection } from "./SkillsSection";
import { SocialMatrixSection } from "./SocialMatrixSection";

/**
 * ABOUT_SECTION_IDS - 关于页区块标识常量
 *
 * 后台配置页与前台注册表共用，保证 id 一致。
 * 命名按语义（非 A/B 线编号），对齐 PRD-0009 区块清单。
 */
export const ABOUT_SECTION_IDS = [
    "hero", // Hero 区（站点名/描述）
    "bio", // 个人简介
    "tech_stack", // 技术栈标签云（旧版单字符串）
    "social", // 社交链接卡片（旧版）
    "avatar_tagline", // A1 头像 + 标语
    "profile_card", // A2 名片卡
    "skills", // A3 技能/兴趣标签云（升级版三组）
    "social_matrix", // A4 社交矩阵（扩展）
    "live_stats", // B2 站点生命体征
    "changelog", // B3 更新日志
    "project_timeline", // B4 项目时间轴
    "project_stack", // B5 项目技术栈
    "blog_numbers", // B6 这座博客的数字
    "thanks", // B7 开源致谢
] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

/** 区块 id → 中文显示名（后台配置页与占位渲染用） */
export const ABOUT_SECTION_LABELS: Record<string, string> = {
    hero: "Hero 区（站点名/描述）",
    bio: "个人简介",
    tech_stack: "技术栈标签云",
    social: "社交链接卡片",
    avatar_tagline: "头像 + 标语",
    profile_card: "名片卡",
    skills: "技能/兴趣标签云（三组）",
    social_matrix: "社交矩阵（扩展）",
    live_stats: "站点生命体征",
    changelog: "更新日志",
    project_timeline: "项目时间轴",
    project_stack: "项目技术栈",
    blog_numbers: "这座博客的数字",
    thanks: "开源致谢",
};

/**
 * 区块注册表 - section id → 渲染组件
 *
 * Issue-0002 骨架阶段：所有区块暂注册为占位组件。
 * 后续 issue 实现真实区块后，在此替换对应条目。
 * 未知 id（配置中存在但未注册）也回退到占位，保证容错。
 */
const registry: Record<string, ComponentType<AboutSectionProps>> = {
    avatar_tagline: AvatarTaglineSection,
    profile_card: ProfileCardSection,
    skills: SkillsSection,
    social_matrix: SocialMatrixSection,
};

/** 取某区块的渲染组件；未注册的 id 回退到占位 */
export function resolveSectionComponent(id: string): ComponentType<AboutSectionProps> {
    return registry[id] ?? AboutSectionPlaceholder;
}
