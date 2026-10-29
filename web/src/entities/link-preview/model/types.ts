/** 网页预览快照，与内容所属的文章、推文或评论无关。 */
export interface LinkPreviewCard {
	url: string;
	title: string;
	description: string;
	site_name: string;
	/** 空串表示没有可展示的封面。 */
	image_url: string;
}

export interface LinkPreviewLookup {
	cards: Record<string, LinkPreviewCard>;
	/** 仍需等待的规范化 URL；可与旧快照同时存在。 */
	pending: string[];
	/** 本次已结束且无快照的 URL，客户端不再轮询。 */
	unavailable: string[];
}

export interface LinkPreviewState {
	url: string;
	card: LinkPreviewCard | null;
	pending: boolean;
}
