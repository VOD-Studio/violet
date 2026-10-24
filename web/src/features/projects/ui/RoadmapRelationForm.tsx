import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@violet/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import { ROADMAP_STAGE_LABELS } from "../lib/roadmap-board";
import { RELATION_KINDS, relationInput } from "../lib/roadmap-relations";
import type { RoadmapItem, RoadmapRelationType } from "../model/roadmap";

/** 搜索结果最多列几条，再多就让人把关键词写具体些。 */
const MAX_RESULTS = 8;

export interface RoadmapRelationFormProps {
	/** 要为它建立关系的条目。 */
	item: RoadmapItem;
	/** 项目的全部条目，从中搜索关系的另一端。 */
	items: readonly RoadmapItem[];
	/** 建立关系；被拒绝时抛出，错误信息说明原因（例如会形成环）。 */
	onRelate: (input: {
		source_id: string;
		target_id: string;
		type: RoadmapRelationType;
	}) => Promise<void>;
}

/** 按编号（「#3」或「3」）或标题里的文字找条目，不含自己。 */
function search(items: readonly RoadmapItem[], self: string, query: string) {
	const text = query.trim().toLowerCase();
	if (!text) return [];
	const number = text.replace(/^#/, "");
	return items
		.filter(
			(entry) =>
				entry.id !== self &&
				(String(entry.number) === number || entry.title.toLowerCase().includes(text)),
		)
		.slice(0, MAX_RESULTS);
}

/** 先选从这个条目出发的关系类型，再搜索并点选另一端的条目，点选即建立。 */
export function RoadmapRelationForm({ item, items, onRelate }: RoadmapRelationFormProps) {
	const [kindKey, setKindKey] = useState(RELATION_KINDS[0].key);
	const [query, setQuery] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const kind = RELATION_KINDS.find((entry) => entry.key === kindKey) ?? RELATION_KINDS[0];
	const results = search(items, item.id, query);

	const relate = async (other: RoadmapItem) => {
		setPending(true);
		setError(null);
		try {
			await onRelate(relationInput(item.id, kind, other.id));
			setQuery("");
		} catch (cause) {
			setError(
				cause instanceof Error && cause.message ? cause.message : "未能建立关系，请重试",
			);
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<Select value={kindKey} onValueChange={setKindKey}>
					<SelectTrigger aria-label="关系类型" size="sm" className="w-28 shrink-0">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{RELATION_KINDS.map((entry) => (
							<SelectItem key={entry.key} value={entry.key}>
								{entry.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					type="search"
					aria-label="搜索要关联的条目"
					placeholder="搜索编号或标题"
					controlSize="sm"
					classNames={{ root: "min-w-0 flex-1" }}
					leading={<Search className="size-4" aria-hidden="true" />}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setError(null);
					}}
				/>
			</div>
			{query.trim() ? (
				results.length > 0 ? (
					<ul aria-label="可关联的条目" className="space-y-1">
						{results.map((other) => (
							<li key={other.id}>
								<button
									type="button"
									disabled={pending}
									onClick={() => void relate(other)}
									className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
								>
									<span className="sr-only">{kind.label}</span>
									<span className="font-mono text-xs text-muted-foreground">
										#{other.number}
									</span>
									<span className="min-w-0 flex-1 font-reading">
										{other.title}
									</span>
									<span className="text-xs text-muted-foreground">
										{ROADMAP_STAGE_LABELS[other.stage]}
									</span>
								</button>
							</li>
						))}
					</ul>
				) : (
					<p className="px-2 text-sm text-muted-foreground">没有匹配的条目</p>
				)
			) : null}
			{error ? (
				<p role="alert" className="text-sm text-destructive-text">
					{error}
				</p>
			) : null}
		</div>
	);
}
