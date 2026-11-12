import type { EmojiPickerGroup, EmojiPickerItem, ReactionItem, ReactionUser } from "@violet/ui";

const SMALL_CHOICES: readonly EmojiPickerItem[] = [
	{ id: "thumb", name: "赞", content: "👍", placeholder: "[赞]" },
	{ id: "heart", name: "喜欢", content: "❤️", placeholder: "[喜欢]" },
	{ id: "fire", name: "热情", content: "🔥", placeholder: "[热情]" },
	{ id: "laugh", name: "开心", content: "😂", placeholder: "[开心]" },
	{ id: "party", name: "庆祝", content: "🎉", placeholder: "[庆祝]" },
	{ id: "think", name: "思考", content: "🤔", placeholder: "[思考]" },
	{ id: "look", name: "围观", content: "👀", placeholder: "[围观]" },
	{ id: "thanks", name: "感谢", content: "🙏", placeholder: "[感谢]" },
	{ id: "clap", name: "鼓掌", content: "👏", placeholder: "[鼓掌]" },
	{ id: "tea", name: "喝茶", content: "🍵", placeholder: "[喝茶]" },
];

const TEXT_CHOICES: readonly EmojiPickerItem[] = [
	{ id: "hello", name: "探头", content: "(・ω・)", placeholder: "(・ω・)" },
	{ id: "cry", name: "哭泣", content: "[T_T]", placeholder: "[T_T]" },
];

export const REACTION_CHOICES = [...SMALL_CHOICES, ...TEXT_CHOICES];
export const REACTION_CHOICES_BY_ID = new Map(
	REACTION_CHOICES.map((choice) => [choice.id, choice]),
);

export function createDemoReaction(
	choice: EmojiPickerItem,
	count: number,
	self: boolean,
): ReactionItem {
	const recentUsers: ReactionUser[] = [];
	if (self) {
		recentUsers.push({ name: "本机用户", self: true });
	}
	for (const name of ["林间", "雾里"]) {
		if (recentUsers.length >= count) {
			break;
		}
		recentUsers.push({ name });
	}
	return { id: choice.id, name: choice.name, content: choice.content, count, self, recentUsers };
}

export function createInitialReactions(state: string): ReactionItem[] {
	if (state === "empty") {
		return [];
	}
	if (state === "single") {
		return [createDemoReaction(SMALL_CHOICES[0], 1, true)];
	}
	if (state === "counts") {
		return [
			createDemoReaction(SMALL_CHOICES[0], 99, false),
			createDemoReaction(SMALL_CHOICES[1], 120, true),
		];
	}
	let count = 3;
	let selected = 1;
	if (state === "comments" || state === "chat" || state === "chat-mine") {
		count = 8;
	}
	if (state === "chat" || state === "chat-mine") {
		selected = 2;
	}
	if (state === "limit") {
		count = 5;
		selected = 3;
	}
	if (state === "visitor") {
		selected = 0;
	}
	return SMALL_CHOICES.slice(0, count).map((choice, index) =>
		createDemoReaction(choice, 12 - index, index < selected),
	);
}

export function createReactionPickerGroups(items: readonly ReactionItem[]): EmojiPickerGroup[] {
	const selected = new Set(items.filter((item) => item.self).map((item) => item.id));
	const markSelected = (choices: readonly EmojiPickerItem[]) =>
		choices.map((choice) => ({ ...choice, selected: selected.has(choice.id) }));
	return [
		{
			id: "small",
			label: "小表情",
			sections: [
				{
					id: "small",
					label: "表情",
					density: "small",
					items: markSelected(SMALL_CHOICES),
				},
			],
		},
		{
			id: "text",
			label: "颜文字",
			sections: [
				{ id: "text", label: "颜文字", density: "text", items: markSelected(TEXT_CHOICES) },
			],
		},
	];
}
