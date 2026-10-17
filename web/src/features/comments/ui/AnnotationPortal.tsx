import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** 越过页面隔离层，仍让批注输入、焦点与选区沿用公开内容方言。 */
export function AnnotationPortal({ children }: { children: ReactNode }) {
	return createPortal(<div className="dialect-public contents">{children}</div>, document.body);
}
