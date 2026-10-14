import type { Branch, Mood, Phase } from "./types";

/** 与 pet/catalog/species.json 的编号一致。 */
export const SPECIES_NAMES = [
	"余烬狐",
	"云絮",
	"家猫",
	"家犬",
	"方块机器人",
	"悬浮无人机",
	"芽苗",
	"余火",
] as const;

export const STAGE_NAMES: Record<string, string> = {
	baby: "幼体",
	young: "少年",
	adult: "成年",
};

export const STAGE_INDEX: Record<string, number> = { baby: 0, young: 1, adult: 2 };

export const RARITY_NAMES = ["常见", "普通", "少见", "稀有", "传说"] as const;

export const PHASE_NAMES: Record<Phase, string> = {
	healthy: "健康",
	warned: "有点不舒服",
	sick: "生病了",
	dead: "已经离世",
};

export const MOOD_NAMES: Record<Mood, string> = {
	sick: "难受",
	hungry: "饿了",
	tired: "困了",
	happy: "开心",
	content: "满足",
};

export const BRANCH_NAMES: Record<Branch, { name: string; hint: string }> = {
	curious: { name: "好奇", hint: "爱探索，性格偏好奇" },
	gentle: { name: "温和", hint: "亲近人，性格偏亲和" },
	steady: { name: "沉稳", hint: "随遇而安，没有特别条件" },
	sage: { name: "贤者", hint: "读得多、想得深" },
	guardian: { name: "守护者", hint: "亲和又沉稳" },
	wanderer: { name: "漫游者", hint: "自由自在，没有特别条件" },
	radiant: { name: "辉光", hint: "后天罕见形态，需要长期照料" },
};

export const MISSING_NAMES: Record<string, string> = {
	level: "等级",
	curious: "好奇",
	affection: "亲和",
	calm: "沉稳",
	topic: "主题",
	topic_variety: "主题种类",
	food: "食物",
};

export const ERROR_NAMES: Record<string, string> = {
	no_food: "没有食物了",
	no_medicine: "没有药品了",
	not_sick: "它没有生病，不需要治疗",
	too_tired: "它太累了，先让它休息",
	dead: "它已经离世，无法再照料",
	not_eligible: "还没满足进化条件",
	time_backwards: "时间不能倒流",
	bad_input: "输入无效",
};
