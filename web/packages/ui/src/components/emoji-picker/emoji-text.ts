import type { EmojiPickerItem } from "./types";

export function emojiItemName(item: EmojiPickerItem): string {
	if (item.selected) {
		return `${item.name}，已回应`;
	}
	return item.name;
}

export function emojiItemDescription(item: EmojiPickerItem): string {
	const details = [item.placeholder, item.aliases?.join(" ")];
	if (item.selected) {
		details.push("已回应");
	}
	details.push(item.disabledReason);
	return details.filter(Boolean).join(" · ");
}
