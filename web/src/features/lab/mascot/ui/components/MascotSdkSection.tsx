import { useState } from "react";
import { copyText } from "@/shared/lib/clipboard";
import type { EmotionDef } from "../../engine/expressions";

interface MascotSdkSectionProps {
	pinnedDef: EmotionDef;
}

/** AI 协议说明与实例化示例:全宽放在舞台布局下方,示例取当前固定表情。 */
export function MascotSdkSection({ pinnedDef }: MascotSdkSectionProps) {
	const [copied, setCopied] = useState(false);

	const handleCopyJson = () => {
		copyText(JSON.stringify({ emotionId: pinnedDef.id, tips: pinnedDef.desc }));
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<section className="mt-16 lg:col-span-2">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-2.5">
				<div>
					<h3 className="text-base font-semibold text-foreground">AI 对接与实例化协议</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						通过标准 JSON 协议接收模型输出。未识别的表情 ID 将自动平滑回退待机。
					</p>
				</div>
				<button
					type="button"
					onClick={handleCopyJson}
					className="shrink-0 cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					{copied ? "已复制 JSON" : "复制 JSON"}
				</button>
			</div>

			<div className="mt-4 grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-border bg-card p-4 font-mono text-xs">
					<p className="mb-2 text-[11px] font-semibold text-muted-foreground">
						1. AI 交互协议(舞台输入框可直接实测)
					</p>
					<pre className="overflow-x-auto text-foreground">
						{`ball.handleAIMessage({
  "emotionId": "${pinnedDef.id}",
  "tips": "${pinnedDef.desc.slice(0, 24)}..."
});`}
					</pre>
				</div>

				<div className="rounded-xl border border-border bg-card p-4 font-mono text-xs">
					<p className="mb-2 text-[11px] font-semibold text-muted-foreground">
						2. 原生实例化(React 宿主见 MascotStage)
					</p>
					<pre className="overflow-x-auto text-foreground">
						{`const ball = new Mascot(container, {
  emotion: "${pinnedDef.id}"
});`}
					</pre>
				</div>
			</div>
		</section>
	);
}
