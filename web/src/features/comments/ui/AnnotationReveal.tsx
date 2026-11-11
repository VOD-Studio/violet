import { type ReactNode, useEffect, useState } from "react";

/** 收起过渡的时长，与样式里的 140ms 同步，过后才卸载内容。 */
const COLLAPSE_MS = 140;

export interface AnnotationRevealProps {
	open: boolean;
	children: ReactNode;
}

/**
 * 在批注卡里展开与收起一块内容：高度由零长到内容高度并淡入，收起时反向，随后卸载。
 *
 * @remarks 收起期间内容不可交互（inert）。内层留出聚焦环向外扩的空间，裁切层里的输入框聚焦环不会缺一截。
 */
export function AnnotationReveal({ open, children }: AnnotationRevealProps) {
	const [mounted, setMounted] = useState(open);
	useEffect(() => {
		if (open) {
			setMounted(true);
			return;
		}
		const timer = window.setTimeout(() => setMounted(false), COLLAPSE_MS);
		return () => window.clearTimeout(timer);
	}, [open]);
	if (!open && !mounted) return null;
	return (
		<div className="annotation-reveal" data-state={open ? "open" : "closed"} inert={!open}>
			<div className="annotation-reveal-inner">{children}</div>
		</div>
	);
}
