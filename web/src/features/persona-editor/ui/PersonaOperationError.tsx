import { Button } from "@shared/ui/base/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface PersonaOperationErrorProps {
	error: { kind: "validation" | "conflict"; message: string } | null;
	onReload: () => void;
}

/** 显式展示校验或并发冲突，并为冲突提供恢复动作。 */
export function PersonaOperationError({ error, onReload }: PersonaOperationErrorProps) {
	if (!error) return null;
	return (
		<div
			className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
			role="alert"
		>
			<div className="flex items-start gap-2 text-sm">
				<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
				<p>{error.message}</p>
			</div>
			{error.kind === "conflict" ? (
				<Button variant="outline" size="sm" onClick={onReload}>
					<RefreshCw className="size-4" />
					重新载入
				</Button>
			) : null}
		</div>
	);
}
