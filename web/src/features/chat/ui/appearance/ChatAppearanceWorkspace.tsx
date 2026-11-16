import {
	Button,
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@violet/ui";
import { useRef, useState } from "react";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";
import styles from "./ChatAppearanceEditor.module.css";

/** 模态编辑保持底下会话、滚动位置和输入草稿挂载。 */
interface ChatAppearanceWorkspaceProps {
	open: boolean;
	user: ChatUser;
	onClose: () => void;
}

export function ChatAppearanceWorkspace({ open, user, onClose }: ChatAppearanceWorkspaceProps) {
	const query = useOwnChatAppearance(user.id);
	const busyRef = useRef(false);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const [busy, setBusy] = useState(false);
	const handleBusyChange = (value: boolean) => {
		busyRef.current = value;
		setBusy(value);
	};
	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next && !busyRef.current) {
					onClose();
				}
			}}
		>
			<SheetContent
				size="lg"
				side="right"
				className={`dialect-public ${styles.workspace}`}
				showCloseButton={!busy}
				onEscapeKeyDown={(event) => {
					if (busyRef.current) {
						event.preventDefault();
					}
				}}
				onPointerDownOutside={(event) => {
					if (busyRef.current) {
						event.preventDefault();
					}
				}}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					titleRef.current?.focus({ preventScroll: true });
				}}
			>
				<SheetHeader>
					<SheetTitle ref={titleRef} tabIndex={-1}>
						聊天外观
					</SheetTitle>
					<SheetDescription>选择气泡和本机背景，保存后应用。</SheetDescription>
				</SheetHeader>
				{query.data ? (
					<ChatAppearanceEditor
						key={user.id}
						initial={query.data}
						user={user}
						onClose={onClose}
						onBusyChange={handleBusyChange}
					/>
				) : (
					<>
						<SheetBody>
							{query.isError ? (
								<div role="alert" className="flex flex-col items-center gap-4 py-8">
									<p className="text-sm text-muted-foreground">
										无法加载已保存的外观。
									</p>
									<Button variant="outline" onClick={() => void query.refetch()}>
										重试
									</Button>
								</div>
							) : (
								<p
									role="status"
									className="py-8 text-center text-sm text-muted-foreground"
								>
									正在读取你的外观…
								</p>
							)}
						</SheetBody>
						<SheetFooter>
							<Button variant="outline" onClick={onClose}>
								取消
							</Button>
						</SheetFooter>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
