import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText } from "@/shared/lib/clipboard";
import { useShikiHighlight } from "@/shared/ui/code-preview/use-shiki-highlight";
import type { EmotionDef } from "../../engine/expressions";

interface CodeCardProps {
	title: string;
	language: string;
	code: string;
}

/** 代码示例卡:shiki 高亮 + 标题栏 + 逐卡复制。 */
function CodeCard({ title, language, code }: CodeCardProps) {
	const { html, loading } = useShikiHighlight(code, language);
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyText(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="text-xs font-medium text-white/70">{title}</span>
				<button
					type="button"
					onClick={handleCopy}
					className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
				>
					{copied ? (
						<Check className="size-3.5 text-green-400" />
					) : (
						<Copy className="size-3.5" />
					)}
					{copied ? "已复制" : "复制"}
				</button>
			</div>
			{loading ? (
				<div className="flex h-24 items-center justify-center">
					<div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
				</div>
			) : html ? (
				<div
					className="code-block-scrollbar overflow-x-auto px-4 py-3 text-xs leading-relaxed [&_code]:font-mono! [&_code]:text-xs! [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki codeToHtml 对代码文本做 HTML 实体转义（<script> 渲染为 &#x3C;script&#x3E; 纯文本，实测无裸标签），输出属性仅 class/style/tabindex 受控集合，无 href/src/on*；代码块内容不可能注入可执行 HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			) : (
				<pre className="code-block-scrollbar overflow-x-auto px-4 py-3 text-xs leading-relaxed text-white/90">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}

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
