import type { PersonaDetail } from "@entities/persona/model/types";
import type { PersonaCompletenessItem } from "@features/persona-editor/model/document";
import { formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { Check, Circle } from "lucide-react";

interface PersonaStatusPanelProps {
	detail: PersonaDetail;
	completeness: PersonaCompletenessItem[];
}

/** 当前选择状态、激活条件与版本信息。 */
export function PersonaStatusPanel({ detail, completeness }: PersonaStatusPanelProps) {
	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between gap-4">
				<CardTitle>激活检查</CardTitle>
				<Badge variant={detail.is_active ? "default" : "outline"}>
					{detail.is_active ? "当前人设" : "未激活"}
				</Badge>
			</CardHeader>
			<CardContent className="space-y-5">
				<ul className="space-y-3">
					{completeness.map((item) => (
						<li key={item.id} className="flex items-center gap-2 text-sm">
							{item.complete ? (
								<Check className="size-4 text-emerald-600 dark:text-emerald-400" />
							) : (
								<Circle className="size-4 text-muted-foreground" />
							)}
							<span
								className={
									item.complete ? "text-foreground" : "text-muted-foreground"
								}
							>
								{item.label}
							</span>
						</li>
					))}
				</ul>

				<div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
					<div className="flex justify-between gap-4">
						<span>版本</span>
						<span className="font-mono tabular-nums">v{detail.version}</span>
					</div>
					<div className="flex justify-between gap-4">
						<span>最近更新</span>
						<time dateTime={detail.updated_at}>
							{formatDateTime(detail.updated_at)}
						</time>
					</div>
				</div>

				{detail.is_active ? (
					<p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
						当前人设不能直接删除。请先激活另一份完整档案。
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
