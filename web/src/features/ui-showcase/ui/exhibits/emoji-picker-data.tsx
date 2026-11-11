import type { EmojiPickerGroup, EmojiPickerItem, EmojiPickerSection } from "@violet/ui";
import { Cat, Clock3, Heart, Smile, Type } from "lucide-react";
import type { ReactNode } from "react";

const SMALL: EmojiPickerItem[] = [
	["微笑", "😀"],
	["开心", "😄"],
	["露齿笑", "😁"],
	["笑哭", "😂"],
	["打滚", "🤣"],
	["害羞", "😊"],
	["浅笑", "🙂"],
	["眨眼", "😉"],
	["喜欢", "😍"],
	["爱你", "🥰"],
	["亲亲", "😘"],
	["好吃", "😋"],
	["酷", "😎"],
	["思考", "🤔"],
	["疑问", "🤨"],
	["无语", "😐"],
	["白眼", "🙄"],
	["得意", "😏"],
	["惊讶", "😮"],
	["震惊", "😲"],
	["困了", "😴"],
	["庆祝", "🥳"],
	["鼓掌", "👏"],
	["赞", "👍"],
	["加油", "💪"],
	["收到", "👌"],
	["握手", "🤝"],
	["感谢", "🙏"],
	["星星", "⭐"],
	["爱心", "❤️"],
].map(([name, content], index) => ({
	id: `system-${index}`,
	name,
	content,
	placeholder: `[${name}]`,
	aliases: index === 3 ? ["xk", "lol"] : undefined,
}));
const LARGE: EmojiPickerItem[] = [
	["猫猫", "🐱"],
	["猫猫笑", "😺"],
	["猫猫笑哭", "😹"],
	["猫猫喜欢", "😻"],
	["黑猫", "🐈‍⬛"],
	["熊猫", "🐼"],
	["水獭", "🦦"],
	["青蛙", "🐸"],
	["鸭鸭", "🦆"],
	["小狗", "🐶"],
].map(([name, content], index) => ({
	id: `custom-${index}`,
	name,
	content,
	placeholder: `[${name}:demo-${index}]`,
	disabledReason: index === 4 ? "会员专属" : undefined,
}));
const TEXT: EmojiPickerItem[] = [
	"(・ω・)",
	"(｡･ω･｡)",
	"ヽ(✿ﾟ▽ﾟ)ノ",
	"(╯°□°)╯︵ ┻━┻",
	"(T_T)",
	"╮(╯▽╰)╭",
].map((content, index) => ({
	id: `text-${index}`,
	name: ["你好", "可爱", "欢呼", "掀桌", "难过", "摊手"][index],
	content,
	placeholder: content,
}));

export const INITIAL_RECENT: readonly EmojiPickerItem[] = [
	...SMALL.slice(0, 8),
	...LARGE.slice(0, 4),
	...TEXT.slice(0, 4),
];
const DENSITIES = new Map<string, EmojiPickerSection["density"]>([
	...SMALL.map((item) => [item.id, "small"] as const),
	...LARGE.map((item) => [item.id, "large"] as const),
	...TEXT.map((item) => [item.id, "text"] as const),
]);
const SECTION_LABELS = { small: "小表情", large: "大表情", text: "颜文字" } as const;
const SECTION_ORDER = ["small", "large", "text"] as const;

function recentSections(items: readonly EmojiPickerItem[]): EmojiPickerSection[] {
	const buckets: Record<EmojiPickerSection["density"], EmojiPickerItem[]> = {
		small: [],
		large: [],
		text: [],
	};
	for (const item of items) {
		// 本地上传不在预置目录内，统一使用大表情格。
		const density = DENSITIES.get(item.id) ?? "large";
		buckets[density].push(item);
	}
	const sections: EmojiPickerSection[] = [];
	for (const density of SECTION_ORDER) {
		if (buckets[density].length > 0) {
			sections.push({
				id: density,
				label: SECTION_LABELS[density],
				density,
				items: buckets[density],
			});
		}
	}
	return sections;
}

interface EmojiPickerDemoOptions {
	state: string;
	recent: readonly EmojiPickerItem[];
	uploaded: readonly EmojiPickerItem[];
	uploadAction: ReactNode;
}

/** 最近使用保留各自密度，会员限制和已回应状态与普通分组一致。 */
export function createEmojiPickerDemoGroups({
	state,
	recent,
	uploaded,
	uploadAction,
}: EmojiPickerDemoOptions): EmojiPickerGroup[] {
	let largeItems = LARGE;
	let recentItems = recent;
	if (state === "unavailable") {
		const markSelected = (item: EmojiPickerItem) => ({
			...item,
			selected: item.id === "custom-1",
		});
		largeItems = LARGE.map(markSelected);
		recentItems = recent.map(markSelected);
	}
	const collectionSections: EmojiPickerSection[] = [
		{
			id: "uploaded",
			label: "我上传的",
			density: "large",
			items: uploaded,
			action: uploadAction,
			emptyMessage: "上传图片，或在正文里右键收藏表情",
		},
	];
	if (state !== "empty") {
		collectionSections.push({
			id: "saved",
			label: "我收藏的",
			density: "large",
			items: LARGE.slice(5, 9),
		});
	}
	return [
		{
			id: "recent",
			label: "最近使用",
			icon: <Clock3 size={17} strokeWidth={1.75} aria-hidden="true" />,
			sections: recentSections(recentItems),
		},
		{
			id: "collection",
			label: "收藏",
			icon: <Heart size={17} strokeWidth={1.75} aria-hidden="true" />,
			sections: collectionSections,
		},
		{
			id: "small",
			label: "小黄脸",
			icon: <Smile size={17} strokeWidth={1.75} aria-hidden="true" />,
			sections: [{ id: "faces", label: "小黄脸", density: "small", items: SMALL }],
		},
		{
			id: "large",
			label: "猫猫",
			icon: <Cat size={17} strokeWidth={1.75} aria-hidden="true" />,
			sections: [{ id: "cats", label: "猫猫", density: "large", items: largeItems }],
		},
		{
			id: "text",
			label: "颜文字",
			icon: <Type size={17} strokeWidth={1.75} aria-hidden="true" />,
			sections: [{ id: "text", label: "颜文字", density: "text", items: TEXT }],
		},
	];
}
