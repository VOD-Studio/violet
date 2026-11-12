import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** 越过页面隔离层，将批注挂在 body 下。 */
export function AnnotationPortal({ children }: { children: ReactNode }) {
	return createPortal(<div className="contents">{children}</div>, document.body);
}
