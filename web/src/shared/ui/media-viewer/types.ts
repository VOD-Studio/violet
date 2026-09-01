/** 可由通用媒体查看器展示的文件。 */
export interface MediaViewerItem {
	id: string;
	url: string;
	/** 原始文件加载期间使用的可选缩略图。 */
	thumbnailUrl?: string;
	mimeType: string;
	name: string;
	/** 文件大小，单位字节。 */
	size?: number;
}

/** 受控媒体查看器参数。 */
export interface MediaViewerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: MediaViewerItem[];
	/** 当前项下标；越界值收敛到最近的有效项，空集合不渲染。 */
	index: number;
	onIndexChange: (index: number) => void;
	/** 关闭查看器后恢复焦点的元素。 */
	triggerElement?: HTMLElement | null;
}
