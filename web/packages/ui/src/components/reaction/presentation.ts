import type { ReactionItem } from "./types";

export function reactionLabel(item: ReactionItem) {
	const label = `${item.name}，${item.count} 人`;
	if (item.self) {
		return `${label}，你已回应`;
	}
	return label;
}

export function reactionPeople(item: ReactionItem) {
	const names: string[] = [];
	const others = Math.max(0, item.count - Number(item.self));
	for (const user of item.recentUsers ?? []) {
		if (user.self || !user.name.trim() || names.includes(user.name)) {
			continue;
		}
		if (names.length >= Math.min(2, others)) {
			break;
		}
		names.push(user.name);
	}
	const shown = item.self ? ["你", ...names] : names;
	const rest = Math.max(0, item.count - shown.length);
	if (shown.length === 0) {
		return `${item.count} 人`;
	}
	const people = shown.join("、");
	if (rest > 0) {
		return `${people}和另外 ${rest} 人`;
	}
	return people;
}

export function displayCount(count: number) {
	return count > 99 ? "99+" : String(count);
}

export function isTextEmoji(content: unknown) {
	return (
		typeof content === "string" &&
		content.length > 2 &&
		!/\p{Extended_Pictographic}/u.test(content)
	);
}

export function reducedMotion(element: HTMLElement) {
	return Boolean(
		element.closest('[data-motion="reduce"]') ||
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
	);
}
