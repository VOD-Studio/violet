import { NOTE_TYPE_LABELS, type NotePitfall, type PublicNote } from "@entities/note/model/types";
import type { Tag as PublicTag } from "@entities/tag/model/types";
import { Link } from "@tanstack/react-router";
import { Badge, CodeBlock, Tag } from "@violet/ui";
import type { JournalSearch } from "../model/navigation";

/** 分类、关联项目和作者记录的踩坑状态。 */
export function NoteBadges({ note }: { note: PublicNote }) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			<Badge tone={note.type === "pitfall" ? "danger" : "neutral"}>
				{NOTE_TYPE_LABELS[note.type]}
			</Badge>
			{note.project && (
				<Tag size="sm" title={note.project.title} className="max-w-full">
					<span className="truncate">{note.project.title}</span>
				</Tag>
			)}
			{note.pitfall && (
				<Badge tone={note.pitfall.resolved ? "ok" : "off"}>
					{note.pitfall.resolved ? "已解决" : "未解决"}
				</Badge>
			)}
		</div>
	);
}

/** 只有标签目录确认名称对应的 slug 时，才提供标签筛选链接。 */
export function NoteTags({
	names,
	catalog,
	search = {},
}: {
	names: string[];
	catalog: PublicTag[];
	search?: JournalSearch;
}) {
	if (names.length === 0) return null;
	return (
		<ul aria-label="标签" className="flex min-w-0 flex-wrap gap-1.5 font-mono text-xs">
			{names.map((name) => {
				const slug = catalog.find((tag) => tag.name === name)?.slug;
				return (
					<li className="min-w-0 max-w-full wrap-anywhere" key={name}>
						{slug ? (
							<Link
								to="/journal"
								search={{ ...search, tag: slug }}
								aria-current={slug === search.tag ? "true" : undefined}
								className="rounded-sm text-muted-foreground underline-offset-4 hover:underline aria-[current=true]:text-foreground"
							>
								#{name}
							</Link>
						) : (
							<span className="text-muted-foreground">#{name}</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}

/** 踩坑拆分字段按作者填写的段落显示；代码保持原文，只读、可复制。 */
export function NotePitfallContent({ pitfall }: { pitfall: NotePitfall }) {
	const sections = [
		{ label: "现象", text: pitfall.symptom },
		{ label: "根因", text: pitfall.cause },
		{ label: "修法", text: pitfall.remedy },
	].filter(({ text }) => text.trim());
	return (
		<>
			{sections.length > 0 && (
				<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-sm leading-relaxed">
					{sections.map(({ label, text }) => (
						<div className="contents" key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="wrap-anywhere whitespace-pre-wrap">{text}</dd>
						</div>
					))}
				</dl>
			)}
			{pitfall.code.trim() && <CodeBlock code={pitfall.code} />}
		</>
	);
}
