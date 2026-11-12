import type { EmojiPickerSection } from "./types";

export interface EmojiCell {
	key: string;
	section: EmojiPickerSection;
	item: EmojiPickerSection["items"][number];
	row: number;
	column: number;
	columns: number;
}

const COLUMNS: Record<EmojiPickerSection["density"], number> = {
	small: 10,
	large: 5,
	text: 3,
};

export function emojiCells(sections: readonly EmojiPickerSection[]): EmojiCell[] {
	const cells: EmojiCell[] = [];
	let row = 0;
	for (const section of sections) {
		const columns = COLUMNS[section.density];
		const offset = section.action == null ? 0 : 1;
		section.items.forEach((item, index) => {
			cells.push({
				key: JSON.stringify([section.id, item.id]),
				section,
				item,
				row: row + Math.floor((index + offset) / columns),
				column: (index + offset) % columns,
				columns,
			});
		});
		row += Math.ceil((section.items.length + offset) / columns);
	}
	return cells;
}

export function nextEmojiCell(cells: readonly EmojiCell[], current: number, key: string): number {
	if (cells.length === 0) {
		return -1;
	}
	if (key === "Home") {
		return 0;
	}
	if (key === "End") {
		return cells.length - 1;
	}
	if (current < 0) {
		return key === "ArrowLeft" || key === "ArrowUp" ? cells.length - 1 : 0;
	}
	if (key === "ArrowLeft") {
		return Math.max(0, current - 1);
	}
	if (key === "ArrowRight") {
		return Math.min(cells.length - 1, current + 1);
	}
	const cell = cells[current];
	const direction = key === "ArrowUp" ? -1 : 1;
	const rows = cells.filter((candidate) => direction * (candidate.row - cell.row) > 0);
	if (rows.length === 0) {
		return current;
	}
	const row = direction < 0 ? rows[rows.length - 1].row : rows[0].row;
	const candidates = rows.filter((candidate) => candidate.row === row);
	const target = (cell.column + 0.5) / cell.columns;
	const nearest = candidates.reduce((best, candidate) => {
		const distance = Math.abs((candidate.column + 0.5) / candidate.columns - target);
		const bestDistance = Math.abs((best.column + 0.5) / best.columns - target);
		if (distance < bestDistance) {
			return candidate;
		}
		return best;
	});
	return cells.indexOf(nearest);
}
