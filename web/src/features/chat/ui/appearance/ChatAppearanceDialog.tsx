import { Button } from "@shared/ui/base/button";
import { PaperDialog } from "@shared/ui/paper-dialog";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";

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
		<PaperDialog
			open={open}
			onOpenChange={onOpenChange}
			titleSrOnly="聊天外观"
			className="h-[min(42rem,calc(100dvh-2.5rem))] max-w-5xl"
			/* 滚动交给编辑器右栏选项区,纸壳内容区自身不滚 */
			contentClassName="flex min-h-0 flex-col overflow-hidden p-4 sm:p-6"
		>
			<header className="mb-3 flex-none">
				<h2 className="text-base font-semibold">聊天外观</h2>
				<p className="text-muted-foreground text-sm">
					头像框、挂件、气泡与徽章按账号保存，跨设备同步。
				</p>
			</header>
			{query.data ? (
				<ChatAppearanceEditor
					key={user.id}
					initial={query.data}
					user={user}
					onClose={() => onOpenChange(false)}
				/>
			) : query.isError ? (
				<div role="alert" className="flex items-center gap-3">
					无法加载已保存的外观。
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							void query.refetch();
						}}
					>
						重试
					</Button>
				</div>
			) : (
				<p role="status" className="text-muted-foreground text-sm">
					正在读取你的外观…
				</p>
			)}
		</PaperDialog>
	);
}
