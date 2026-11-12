export interface ReactionUser {
	id: string;
	name: string;
}

/** 评论与聊天的聚合回应；recent_users 是后端公开的最近至多三位参与者。 */
export interface AggregatedReaction {
	emoji_id: number;
	emoji_name: string;
	emoji_url: string;
	gif_url?: string;
	count: number;
	self: boolean;
	recent_users: ReactionUser[];
}

/** 评论批量读取的单条结果；文章与推文接口共用同一形态。 */
export interface CommentReactionResult {
	comment_id: string;
	reactions: AggregatedReaction[];
}
