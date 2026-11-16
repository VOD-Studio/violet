import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@violet/ui";
import { type ReactNode, useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";
function subscribe(callback: () => void) {
	const query = window.matchMedia(QUERY);
	query.addEventListener("change", callback);
	return () => query.removeEventListener("change", callback);
}
const snapshot = () => window.matchMedia(QUERY).matches;
const serverSnapshot = () => false;

/** 宽屏保留页面可交互，窄屏使用模态；焦点、关闭与动效都沿用 Sheet。 */
export interface ConversationDetailsFrameProps {
	open: boolean;
	children: ReactNode;
	onClose: () => void;
}

export function ConversationDetailsFrame({
	open,
	children,
	onClose,
}: ConversationDetailsFrameProps) {
	const wide = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
	return (
		<Sheet
			open={open}
			modal={!wide}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent size="sm" aria-describedby={undefined}>
				<SheetHeader>
					<SheetTitle>会话详情</SheetTitle>
				</SheetHeader>
				<SheetBody className="space-y-5">{children}</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
