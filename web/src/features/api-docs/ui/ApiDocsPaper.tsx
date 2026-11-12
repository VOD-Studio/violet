import { PaperDialog } from "@shared/ui/paper-dialog";

import { useApiDocsDialogStore } from "../model/store";
import { ApiReference } from "./ApiReference";

/** 手撕纸弹窗里的实时 API 参考文档；首次唤出时才下载。 */
export default function ApiDocsPaper() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const close = useApiDocsDialogStore((s) => s.close);
	const open = useApiDocsDialogStore((s) => s.open);
	return (
		<PaperDialog
			open={isOpen}
			onOpenChange={(next) => (next ? open() : close())}
			titleSrOnly="API 参考文档手卷"
			/* 滚动交给内部双栏（总目/正文各自独立滚动），纸壳内容区自身不滚 */
			contentClassName="overflow-hidden"
		>
			<ApiReference />
		</PaperDialog>
	);
}
