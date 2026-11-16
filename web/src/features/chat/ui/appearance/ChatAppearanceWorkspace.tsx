import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { useRef, useState } from "react";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";

/** 模态编辑保持底下会话、滚动位置和输入草稿挂载。 */
interface ChatAppearanceWorkspaceProps {
	open: boolean;
	user: ChatUser;
	onClose: () => void;
}

export function ChatAppearanceWorkspace({ open, user, onClose }: ChatAppearanceWorkspaceProps) {
	const query = useOwnChatAppearance(user.id);
	const busyRef = useRef(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const [busy, setBusy] = useState(false);
	const handleBusyChange = (value: boolean) => {
		busyRef.current = value;
		setBusy(value);
	};
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !busyRef.current) {
					onClose();
				}
			}}
		>
			<DialogContent
				ref={contentRef}
				size="lg"
				className="dialect-public"
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
					const target = contentRef.current?.querySelector<HTMLInputElement>(
						'input[type="radio"]:checked',
					);
					if (target) {
						event.preventDefault();
						target.focus({ preventScroll: true });
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>聊天外观</DialogTitle>
					<DialogDescription>选择气泡和本机背景，保存后应用。</DialogDescription>
				</DialogHeader>
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
						<DialogBody>
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
						</DialogBody>
						<DialogFooter>
							<Button variant="outline" onClick={onClose}>
								取消
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
