/** X 来源明确提供的认证类别，分别对应蓝色、金色和灰色徽章。 */
export type TweetVerification = "individual" | "business" | "government";

/** 来源提供的组织关联标识，不根据作者账号推断组织关系。 */
export interface TweetAffiliation {
	/** 关联组织的显示名称；来源未提供时省略。 */
	name?: string;
	/** 关联组织徽标的安全图片地址。 */
	imageUrl: string;
	/** 关联组织的主页地址；来源未提供时仅展示徽标。 */
	url?: string;
}

/** 原作者身份；头像缺失或加载失败不会隐藏作者名字与账号。 */
export interface TweetAuthor {
	/** 作者显示名称。 */
	name: string;
	/** 作者账号，可以包含开头的 @。 */
	handle: string;
	/** 作者主页地址；省略时由合法账号生成 X 主页。 */
	url?: string;
	/** 头像的 HTTP(S) 或同源根相对地址。 */
	avatarUrl?: string;
	/** 来源明确提供的认证类别；未认证或未知时省略。 */
	verification?: TweetVerification;
	/** 来源明确提供的组织关联，不等同于作者自身认证类别。 */
	affiliation?: TweetAffiliation;
}
