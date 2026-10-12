/** MCP/agent 发表标识；署名是模型自述，不表示经过身份验证。 */
import { cn } from "cn";
import { Sparkles } from "lucide-react";
import { getCommentAuthorPresentation } from "../lib/ai-personas";
import "./ai-personas.css";

export interface AIBadgeProps {
	/** 是否显示（通常为 is_ai === true） */
	show: boolean;
	name?: string;
}

export function AIBadge({ show, name }: AIBadgeProps) {
	if (!show) return null;
	const personaId =
		name === undefined
			? undefined
			: getCommentAuthorPresentation({ author_name: name, is_ai: true }).personaId;
	return (
		<span
			data-ai-persona={personaId}
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
				personaId ? "bg-(--ai-accent)/10 text-(--ai-accent)" : "bg-primary/10 text-primary",
			)}
			title="由 AI 通过 MCP 发表，署名由模型自行提供"
		>
			<Sparkles className="size-3" />
			AI
		</span>
	);
}

export default AIBadge;
