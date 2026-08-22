import type { EmotionDef } from "@violet/mascot";
import { Check, Copy, MoveRight } from "lucide-react";
import { useState } from "react";

interface CodeSampleProps {
	label: string;
	language: string;
	code: string;
}

function CodeSample({ label, language, code }: CodeSampleProps) {
	const [isCopied, setIsCopied] = useState(false);

	const copyCode = async () => {
		await navigator.clipboard.writeText(code);
		setIsCopied(true);
		window.setTimeout(() => setIsCopied(false), 1600);
	};

	return (
		<article className="min-w-0 bg-[#eef0eb]">
			<header className="flex h-11 items-center justify-between border-b border-[#11110f] px-3">
				<div className="flex items-baseline gap-2">
					<h3 className="text-xs font-bold">{label}</h3>
					<span className="font-mono text-[9px] text-[#11110f]/45">{language}</span>
				</div>
				<button
					type="button"
					onClick={copyCode}
					className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-[#11110f] bg-white px-2 text-[9px] font-bold transition-colors hover:bg-[#eceee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent) focus-visible:ring-inset"
				>
					{isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
					{isCopied ? "已复制" : "复制"}
				</button>
			</header>
			<pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-[#11110f]">
				<code>{code}</code>
			</pre>
		</article>
	);
}

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
		<section className="mt-8 border-2 border-[#11110f] bg-[#f8f9f5]">
			<header className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)] sm:items-end lg:p-6">
				<div>
					<p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#11110f]/50">
						Developer handoff
					</p>
					<h2 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
						接到你的界面里
					</h2>
				</div>
				<div>
					<p className="max-w-100 text-sm leading-relaxed text-[#11110f]/65">
						AI 只需发送表情 ID
						与一句提示。未知状态会回到待机，当前选择会直接写入下面的示例。
					</p>
					<p className="mt-3 inline-flex items-center gap-2 text-xs font-bold">
						当前状态 {pinnedDef.id} / {pinnedDef.en}
						<MoveRight className="size-3.5" />
					</p>
				</div>
			</header>

			<div className="grid gap-px border-t-2 border-[#11110f] bg-[#11110f] md:grid-cols-2">
				<CodeSample label="AI 消息协议" language="typescript" code={messageCode} />
				<CodeSample label="实例化" language="typescript" code={instanceCode} />
			</div>
		</section>
	);
}
