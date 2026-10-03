import { useRef } from "react";
import type { UiDocsNavItem } from "../model/navigation";
import { UiDocsSidebar } from "./UiDocsSidebar";

/** 当前文档的移动目录入口。 */
export interface UiDocsMobileNavProps {
	activeItem: UiDocsNavItem;
	currentPath: string;
}

export function UiDocsMobileNav({ activeItem, currentPath }: UiDocsMobileNavProps) {
	const detailsRef = useRef<HTMLDetailsElement>(null);

	return (
		<details
			ref={detailsRef}
			className="mb-8 rounded-lg border border-border md:hidden"
			onKeyDown={(event) => {
				if (event.key === "Escape" && detailsRef.current?.open) {
					detailsRef.current.open = false;
					detailsRef.current.querySelector("summary")?.focus();
				}
			}}
		>
			<summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
				目录
				<span className="ml-3 font-normal text-muted-foreground">{activeItem.title}</span>
			</summary>
			<UiDocsSidebar
				currentPath={currentPath}
				className="border-t border-border px-3 py-5"
				onNavigate={() => {
					if (detailsRef.current) detailsRef.current.open = false;
				}}
			/>
		</details>
	);
}
