import { copyText } from "@shared/lib/clipboard";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { LightCodeBlock } from "./LightCodeBlock";

/**
 * 展示真实组件及对应代码；较长代码可展开查看与复制。
 */
export function ComponentDemo({ children, code }: { children: ReactNode; code: string }) {
	const collapsible = code.split("\n").length > 6;
	const [showCode, setShowCode] = useState(!collapsible);
	const [copied, setCopied] = useState(false);
	const codeId = useId();
	const codeRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<Animation | null>(null);

	const handleCopy = async () => {
		const ok = await copyText(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const toggleCode = () => {
		const codeBox = codeRef.current;
		const nextOpen = !showCode;
		if (codeBox) {
			const from = codeBox.getBoundingClientRect().height;
			const to = nextOpen ? Math.max(208, codeBox.scrollHeight) : 208;
			animationRef.current?.cancel();
			if (from !== to && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				const animation = codeBox.animate(
					[{ height: `${from}px` }, { height: `${to}px` }],
					{ duration: 260, easing: "ease-in-out" },
				);
				animationRef.current = animation;
				animation.onfinish = () => {
					if (animationRef.current === animation) animationRef.current = null;
				};
			}
		}
		setShowCode(nextOpen);
	};

	return (
		<div className="overflow-hidden rounded-xl border border-border/70 bg-card">
			<div className="flex min-h-64 items-center justify-center p-6 sm:p-10">
				<div className="w-full max-w-2xl">{children}</div>
			</div>

			<div className="relative border-t border-border/60">
				<button
					type="button"
					onClick={handleCopy}
					className="absolute top-3.5 right-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
					title="复制代码"
				>
					{copied ? (
						<Check className="size-4 text-green-500" />
					) : (
						<Copy className="size-4" />
					)}
					<span className="sr-only">复制代码</span>
				</button>

				<div
					ref={codeRef}
					id={codeId}
					className={`relative overflow-hidden ${!collapsible || showCode ? "h-auto" : "h-52"}`}
				>
					<div className={collapsible ? "pb-16" : undefined}>
						<LightCodeBlock code={code} />
					</div>
					{collapsible && (
						<div
							aria-hidden="true"
							className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/90 to-transparent transition-opacity duration-200 ${
								showCode ? "opacity-0" : "opacity-100"
							}`}
						/>
					)}
				</div>

				{collapsible && (
					<button
						type="button"
						onClick={toggleCode}
						aria-expanded={showCode}
						aria-controls={codeId}
						className="absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center rounded-full border border-border/70 bg-card px-4 py-1.5 text-sm text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-colors hover:bg-muted"
					>
						{showCode ? "Collapse code" : "Expand code"}
					</button>
				)}
			</div>
		</div>
	);
}
