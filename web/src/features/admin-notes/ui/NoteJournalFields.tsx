import { NOTE_TYPE_LABELS, NOTE_TYPES } from "@entities/note/model/types";
import { useProjects } from "@entities/project/api/queries";
import { NOTE_FORM_DEFAULTS, type NoteJournalForm } from "@features/admin-notes/model/schema";
import {
	Checkbox,
	Field,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@violet/ui";
import { useId } from "react";

const NO_PROJECT = "none";
const PITFALL_TEXT_FIELDS = [
	{ name: "symptom", label: "现象" },
	{ name: "cause", label: "根因" },
	{ name: "remedy", label: "修法" },
	{ name: "code", label: "代码" },
] as const;

/** 手记属性由宿主表单持有；切离踩坑类型时清除踩坑输入。 */
export interface NoteJournalFieldsProps {
	value: NoteJournalForm;
	onChange: (value: NoteJournalForm) => void;
}

/** 快速笔记与全屏工作台共用的手记属性字段。 */
export function NoteJournalFields({ value, onChange }: NoteJournalFieldsProps) {
	const projects = useProjects();
	const resolvedId = useId();
	const unavailableProject =
		value.project_id !== null &&
		!projects.data?.some((project) => project.id === value.project_id)
			? value.project_id
			: null;

	return (
		<div>
			<Field label="类型" orientation="horizontal">
				<Select
					value={value.type}
					onValueChange={(next) => {
						const type = NOTE_TYPES.find((candidate) => candidate === next);
						if (!type || type === value.type) return;
						onChange({ ...value, type, pitfall: NOTE_FORM_DEFAULTS.journal.pitfall });
					}}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{NOTE_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{NOTE_TYPE_LABELS[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field
				label="关联项目"
				optional
				orientation="horizontal"
				checking={projects.isLoading ? "正在加载公开项目…" : undefined}
				hint={projects.isError ? "公开项目列表加载失败" : undefined}
			>
				<Select
					value={value.project_id ?? NO_PROJECT}
					onValueChange={(projectId) =>
						onChange({
							...value,
							project_id: projectId === NO_PROJECT ? null : projectId,
						})
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_PROJECT}>不关联项目</SelectItem>
						{unavailableProject ? (
							<SelectItem value={unavailableProject} disabled>
								已关联项目
							</SelectItem>
						) : null}
						{projects.data?.map((project) => (
							<SelectItem key={project.id} value={project.id}>
								{project.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			{value.type === "pitfall" ? (
				<>
					{PITFALL_TEXT_FIELDS.map(({ name, label }) => (
						<Field key={name} label={label} optional orientation="horizontal">
							<Textarea
								rows={2}
								className={name === "code" ? "font-mono" : undefined}
								value={value.pitfall[name]}
								onChange={(event) =>
									onChange({
										...value,
										pitfall: { ...value.pitfall, [name]: event.target.value },
									})
								}
							/>
						</Field>
					))}
					<div className="flex items-center gap-2">
						<Checkbox
							id={resolvedId}
							checked={value.pitfall.resolved}
							onCheckedChange={(checked) =>
								onChange({
									...value,
									pitfall: { ...value.pitfall, resolved: checked === true },
								})
							}
						/>
						<Label htmlFor={resolvedId}>已解决</Label>
					</div>
				</>
			) : null}
		</div>
	);
}
