import type { RoadmapChecklistItem } from "../model/roadmap";

export interface ChecklistProgress {
	done: number;
	total: number;
}

export function checklistProgress(checklist: readonly RoadmapChecklistItem[]): ChecklistProgress {
	return { done: checklist.filter((entry) => entry.done).length, total: checklist.length };
}
