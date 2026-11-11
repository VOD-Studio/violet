import { useCallback, useState } from "react";
import type { ReactionItem } from "./types";

export interface ReactionEntry {
	item: ReactionItem;
	entering: boolean;
	exiting: boolean;
}

export function useReactionPresence(items: readonly ReactionItem[]) {
	const [state, setState] = useState(() => ({
		source: items,
		entries: items.map((item) => ({ item, entering: false, exiting: false })),
	}));

	if (state.source !== items) {
		const previous = new Map(state.entries.map((entry) => [entry.item.id, entry]));
		const nextIds = new Set(items.map((item) => item.id));
		const entries: ReactionEntry[] = items.map((item) => {
			const entry = previous.get(item.id);
			return { item, entering: !entry || entry.exiting || entry.entering, exiting: false };
		});
		for (let index = 0; index < state.entries.length; index += 1) {
			const entry = state.entries[index];
			if (!nextIds.has(entry.item.id)) {
				entries.splice(Math.min(index, entries.length), 0, { ...entry, exiting: true });
			}
		}
		setState({ source: items, entries });
	}

	const settle = useCallback((id: string, exiting: boolean) => {
		setState((current) => {
			const entry = current.entries.find((candidate) => candidate.item.id === id);
			if (!entry || entry.exiting !== exiting) {
				return current;
			}
			if (exiting) {
				return {
					...current,
					entries: current.entries.filter((candidate) => candidate.item.id !== id),
				};
			}
			return {
				...current,
				entries: current.entries.map((candidate) => {
					if (candidate.item.id === id) {
						return { ...candidate, entering: false };
					}
					return candidate;
				}),
			};
		});
	}, []);

	return { entries: state.entries, settle };
}
