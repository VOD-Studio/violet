import type { PersonaSaveState } from "@features/persona-editor/model/types";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CircleCheck, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import { PersonaSaveIndicator } from "./PersonaSaveIndicator";

interface PersonaEditorToolbarProps {
	canManage: boolean;
	isActive: boolean;
	isComplete: boolean;
	saveState: PersonaSaveState;
	busy: boolean;
	activating: boolean;
	onActivate: () => void;
	onDelete: () => void;
	onSave: () => void;
}

/** 人设工作台的返回、公开维护与保存动作。 */
export function PersonaEditorToolbar({
	canManage,
	isActive,
	isComplete,
	saveState,
	busy,
	activating,
	onActivate,
	onDelete,
	onSave,
}: PersonaEditorToolbarProps) {
	const maintenanceDisabled = busy || saveState !== "saved";
	const saveDisabled = busy || saveState === "conflict" || saveState === "saved";
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
			<div className="flex flex-wrap items-center gap-3">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/admin/personas">
						<ArrowLeft className="size-4" />
						返回列表
					</Link>
				</Button>
				<PersonaSaveIndicator state={saveState} />
				{!canManage ? <Badge variant="outline">只读</Badge> : null}
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2">
				{isActive ? (
					<Button variant="outline" size="sm" asChild>
						<Link to="/persona">
							<ExternalLink className="size-4" />
							查看公开页
						</Link>
					</Button>
				) : null}
				{canManage ? (
					<>
						<Button
							variant="outline"
							size="sm"
							disabled={isActive || maintenanceDisabled || !isComplete}
							title={
								isActive
									? "这份档案已经是当前人设"
									: saveState !== "saved"
										? "请先保存修改"
										: !isComplete
											? "请先补全激活所需资料"
											: undefined
							}
							onClick={onActivate}
						>
							{activating ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<CircleCheck className="size-4" />
							)}
							{isActive ? "已激活" : "设为当前人设"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={isActive || maintenanceDisabled}
							title={isActive ? "当前人设不能删除" : undefined}
							onClick={onDelete}
						>
							<Trash2 className="size-4" />
							删除
						</Button>
						<Button size="sm" disabled={saveDisabled} onClick={onSave}>
							{saveState === "saving" ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							保存档案
						</Button>
					</>
				) : null}
			</div>
		</div>
	);
}
