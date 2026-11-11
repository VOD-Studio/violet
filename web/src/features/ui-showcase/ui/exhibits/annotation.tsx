import { AnnotationQuote } from "@features/comments/ui/AnnotationQuote";
import {
	AnnotationCardFrame,
	AnnotationMark,
	AnnotationToolButton,
	AnnotationToolbar,
	Button,
} from "@violet/ui";
import { Copy, MessageSquareQuote, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useRef, useState } from "react";
import "@features/comments/ui/annotations.css";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const QUOTE = "阅读，是与另一个灵魂相遇。";

function AnnotationStage({ state }: ExhibitRenderProps) {
	const [host, setHost] = useState<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(state === "card");
	const [selected, setSelected] = useState(state === "selected");
	const [copyStatus, setCopyStatus] = useState("");
	const textRef = useRef<HTMLElement>(null);
	const selectText = () => {
		const text = textRef.current;
		if (!text) return;
		const range = document.createRange();
		range.selectNodeContents(text);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		setSelected(true);
	};
	return (
		<div
			ref={setHost}
			className="relative isolate h-60 w-140 text-sm"
			onPointerUp={() => {
				const selection = window.getSelection();
				if (
					selection &&
					!selection.isCollapsed &&
					host?.contains(selection.anchorNode) &&
					host.contains(selection.focusNode)
				)
					setSelected(true);
			}}
		>
			<div className="absolute inset-s-4 top-2 flex items-center gap-3">
				{selected && (
					<AnnotationToolbar>
						<AnnotationToolButton
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => setOpen(true)}
						>
							<MessageSquareQuote className="size-4" aria-hidden="true" />
							批注
						</AnnotationToolButton>
						<AnnotationToolButton
							onMouseDown={(event) => event.preventDefault()}
							onClick={async () => {
								try {
									const selection = window.getSelection();
									const text =
										selection &&
										host?.contains(selection.anchorNode) &&
										host.contains(selection.focusNode)
											? selection.toString()
											: "";
									await navigator.clipboard.writeText(text || QUOTE);
									setCopyStatus("已复制");
								} catch {
									setCopyStatus("复制失败，请重试");
								}
							}}
						>
							<Copy className="size-4" aria-hidden="true" />
							复制
						</AnnotationToolButton>
					</AnnotationToolbar>
				)}
				<Button variant="ghost" size="sm" onClick={selectText}>
					选择原文
				</Button>
				<span role="status" className="text-xs text-muted-foreground">
					{copyStatus || "也可直接拖选"}
				</span>
			</div>
			<Popover.Root open={open && host !== null} onOpenChange={setOpen}>
				<p className="absolute inset-s-4 top-16 m-0 leading-7">
					<Popover.Trigger asChild>
						<AnnotationMark
							ref={textRef}
							aria-label={`1 条批注：${QUOTE}`}
							aria-haspopup="dialog"
						>
							{QUOTE}
						</AnnotationMark>
					</Popover.Trigger>
					<span className="ml-4 text-xs text-muted-foreground">林间 · 1 条批注</span>
				</p>
				{host && (
					<Popover.Portal container={host}>
						<Popover.Content
							asChild
							side="bottom"
							align="start"
							sideOffset={8}
							avoidCollisions={false}
							onOpenAutoFocus={(event) => event.preventDefault()}
						>
							<AnnotationCardFrame
								aria-label="林间的批注"
								className="v-float outline-none"
							>
								<div className="flex items-center justify-between gap-2">
									<strong className="text-xs">
										林间{" "}
										<span className="font-normal text-muted-foreground">
											· 刚刚
										</span>
									</strong>
									<Popover.Close asChild>
										<Button
											variant="ghost"
											size="sm"
											className="size-6 p-0"
											aria-label="关闭批注"
										>
											<X className="size-3.5" />
										</Button>
									</Popover.Close>
								</div>
								<AnnotationQuote>{QUOTE}</AnnotationQuote>
								<p className="m-0 text-xs leading-5">
									有时一句话，就能把陌生人的距离拉近。
								</p>
							</AnnotationCardFrame>
						</Popover.Content>
					</Popover.Portal>
				)}
			</Popover.Root>
		</div>
	);
}

/** 批注显示单元：选区、已有标记与宽 320px 的真实浮层。 */
export const annotationExhibit: Exhibit = {
	id: "annotation",
	name: "批注",
	units: ["annotation"],
	zone: "content",
	category: "content",
	footprint: { width: 560, height: 240 },
	states: [
		{ id: "selected", label: "选区工具栏" },
		{ id: "annotated", label: "已有批注" },
		{ id: "card", label: "批注卡" },
	],
	Render: ({ state }) => <AnnotationStage key={state} state={state} />,
};
