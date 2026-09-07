import { arrayMove } from "@dnd-kit/sortable";
import { createPersonaFact, MAX_PERSONA_FACTS } from "@features/persona-editor/model/document";
import type { PersonaDraftFact } from "@features/persona-editor/model/types";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

interface PersonaFactsSectionProps {
	facts: PersonaDraftFact[];
	disabled: boolean;
	onChange: (facts: PersonaDraftFact[]) => void;
}

/** 有序资料项编辑区，移动按钮同时覆盖键盘排序。 */
export function PersonaFactsSection({ facts, disabled, onChange }: PersonaFactsSectionProps) {
	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between gap-4">
				<div>
					<CardTitle>资料项</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">
						{facts.length}/{MAX_PERSONA_FACTS} 项，公开页按当前顺序展示
					</p>
				</div>
				{!disabled ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={facts.length >= MAX_PERSONA_FACTS}
						onClick={() => onChange([...facts, createPersonaFact()])}
					>
						<Plus className="size-4" />
						添加资料
					</Button>
				) : null}
			</CardHeader>
			<CardContent>
				{facts.length === 0 ? (
					<p className="rounded-lg bg-muted/45 px-4 py-6 text-center text-sm text-muted-foreground">
						还没有资料项，可从姓名、年龄、身份或生日开始。
					</p>
				) : (
					<div className="divide-y">
						{facts.map((fact, index) => (
							<div
								key={fact.editor_key}
								className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(9rem,0.55fr)_minmax(0,1.45fr)_auto] sm:items-start"
							>
								<Input
									value={fact.label}
									disabled={disabled}
									aria-label={`第 ${index + 1} 项资料名称`}
									aria-invalid={Array.from(fact.label).length > 40}
									placeholder="资料名称"
									onChange={(event) =>
										onChange(
											facts.map((candidate, candidateIndex) =>
												candidateIndex === index
													? { ...candidate, label: event.target.value }
													: candidate,
											),
										)
									}
								/>
								<Textarea
									value={fact.value}
									disabled={disabled}
									aria-label={`第 ${index + 1} 项资料内容`}
									aria-invalid={Array.from(fact.value).length > 300}
									placeholder="资料内容"
									className="min-h-10 resize-y"
									onChange={(event) =>
										onChange(
											facts.map((candidate, candidateIndex) =>
												candidateIndex === index
													? { ...candidate, value: event.target.value }
													: candidate,
											),
										)
									}
								/>
								{!disabled ? (
									<div className="flex items-center justify-end gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											disabled={index === 0}
											onClick={() =>
												onChange(arrayMove(facts, index, index - 1))
											}
											aria-label={`上移第 ${index + 1} 项资料`}
										>
											<ArrowUp className="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											disabled={index === facts.length - 1}
											onClick={() =>
												onChange(arrayMove(facts, index, index + 1))
											}
											aria-label={`下移第 ${index + 1} 项资料`}
										>
											<ArrowDown className="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											onClick={() =>
												onChange(
													facts.filter(
														(_, candidateIndex) =>
															candidateIndex !== index,
													),
												)
											}
											aria-label={`删除第 ${index + 1} 项资料`}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								) : null}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
