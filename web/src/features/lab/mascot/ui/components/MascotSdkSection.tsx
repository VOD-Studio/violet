import { CodeCard } from "@/shared/ui/code-preview";
import type { EmotionDef } from "../../engine/expressions";

interface MascotSdkSectionProps {
	pinnedDef: EmotionDef;
}

/** AI 协议与实例化示例:全宽放在舞台布局下方,示例取当前固定表情。 */
export function MascotSdkSection({ pinnedDef }: MascotSdkSectionProps) {
	return (
		<section className="mt-16 lg:col-span-2">
			<div className="border-b border-border pb-2.5">
				<h3 className="text-base font-semibold text-foreground">AI 对接与实例化协议</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					通过标准 JSON 协议接收模型输出。未识别的表情 ID 将自动平滑回退待机。
				</p>
			</div>

			<div className="mt-4 grid items-start gap-4 md:grid-cols-2">
				<CodeCard
					title="AI 消息协议"
					language="typescript"
					code={`mascot.handleAIMessage({
  emotionId: "${pinnedDef.id}",
  tips: "${pinnedDef.desc.slice(0, 24)}..."
});`}
				/>
				<CodeCard
					title="实例化"
					language="typescript"
					code={`const mascot = new Mascot(container, {
  emotion: "${pinnedDef.id}"
});`}
				/>
			</div>
		</section>
	);
}
