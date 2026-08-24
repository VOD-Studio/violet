import type { EmotionDef } from "@violet/mascot";
import { Code2, MoveRight } from "lucide-react";
import { CodeCard } from "@/shared/ui/code-preview";

interface MascotSdkSectionProps {
	pinnedDef: EmotionDef;
}

/** 展示当前状态对应的 AI 消息与实例化代码。 */
export function MascotSdkSection({ pinnedDef }: MascotSdkSectionProps) {
	const messageCode = `mascot.handleAIMessage({
  emotionId: "${pinnedDef.id}",
  tips: "${pinnedDef.desc.slice(0, 24)}..."
});`;
	const instanceCode = `const mascot = new Mascot(container, {
  emotion: "${pinnedDef.id}"
});`;

	return (
		<section className="mt-8 border border-edge-hairline bg-background">
			<header className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
				<div className="flex items-center gap-3">
					<Code2 className="size-5 shrink-0 text-neon-blue" />
					<div>
						<p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
							Developer handoff
						</p>
						<h2 className="mt-1 text-2xl font-semibold tracking-tight">
							接到你的界面里
						</h2>
					</div>
				</div>
				<div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
					<span className="size-1.5 bg-neon-blue" />
					{pinnedDef.id} / {pinnedDef.en}
					<MoveRight className="size-3.5 text-neon-blue" />
				</div>
			</header>

			<div className="grid gap-4 border-t border-edge-hairline bg-muted/20 p-4 md:grid-cols-2">
				<CodeCard title="AI 消息协议" language="typescript" code={messageCode} />
				<CodeCard title="实例化" language="typescript" code={instanceCode} />
			</div>
		</section>
	);
}
