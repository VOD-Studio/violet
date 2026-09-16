import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/base/dialog";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";
import styles from "./ChatAppearanceEditor.module.css";

export interface ChatAppearanceDialogProps {
	/** 受控开合,由可见入口按钮驱动。 */
	open: boolean;
	/** 既有的账号对象;绝不要求用户手输账号 ID。 */
	user: ChatUser;
	/** 关闭弹窗,不改已保存设置。 */
	onOpenChange: (open: boolean) => void;
}

/** 设置加载失败时给重试入口,不给可编辑的空/默认态。 */
export function ChatAppearanceDialog({ open, user, onOpenChange }: ChatAppearanceDialogProps) {
	const query = useOwnChatAppearance(user.id);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.dialog}>
				<DialogHeader>
					<DialogTitle>聊天外观</DialogTitle>
					<DialogDescription>
						头像框、挂件、气泡与徽章按账号保存，跨设备同步。
					</DialogDescription>
				</DialogHeader>
				{query.data ? (
					<ChatAppearanceEditor
						key={user.id}
						initial={query.data}
						user={user}
						onClose={() => onOpenChange(false)}
					/>
				) : query.isError ? (
					<div role="alert">
						无法加载已保存的外观。
						<Button
							onClick={() => {
								void query.refetch();
							}}
						>
							重试
						</Button>
					</div>
				) : (
					<p role="status">正在读取你的外观…</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
