import { cn } from "@shared/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

export interface HistoryBackProps {
	fallbackTo: string;
	children: ReactNode;
	className?: string;
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

/** 优先返回同标签页历史来源；无可返回历史时进入业务父级。 */
export function HistoryBack({ fallbackTo, children, className, onClick }: HistoryBackProps) {
	const router = useRouter();
	const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		if (window.history.length > 1) {
			router.history.back();
			return;
		}
		void router.navigate({ to: fallbackTo });
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn("inline-flex items-center", className)}
		>
			<ArrowLeft className="size-4" />
			{children}
		</button>
	);
}
