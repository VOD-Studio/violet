/** 公开装饰的目录 ID;空串表示“保持原始聊天样式”。 */
export interface ChatAppearance {
	/** 空串移除圆形头像框。 */
	avatar_frame_id: string;
	/** 空串移除右下角小挂件。 */
	avatar_charm_id: string;
	/** 空串恢复既有的收发双方气泡配色。 */
	bubble_theme_id: string;
}

/** 只有本人(已登录)的端点才返回 revision。 */
export interface ChatAppearanceState extends ChatAppearance {
	/** 服务端返回的乐观锁版本号;零表示还没有偏好行。 */
	revision: number;
}

/** 本应用素材目录中登记的安全图片。 */
export interface AppearanceAsset {
	/** 服务端白名单接受的稳定 ID。 */
	id: string;
	/** 选择器里展示的可读名称。 */
	name: string;
	/** 同源静态资源,绝不是用户提供的 URL。 */
	image: string;
}

/** 头像框围绕原头像的尺寸标定。 */
export interface AvatarFrameAsset extends AppearanceAsset {
	/** 相对头像本体的固定放大比;不改变头像的布局盒。 */
	scale: number;
}

/** 九宫格气泡皮肤,装饰独立定位,附可读文字色。 */
export interface BubbleThemeAsset extends AppearanceAsset {
	/** 独立透明装饰,不得随消息内容拉伸。 */
	ornament: string;
	/** 针对该底板校准过的文字色。 */
	ink: string;
	/** 九宫格图缺失时可读的兜底底色。 */
	fill: string;
	/** 切片尺寸,按源 PNG 的像素计。 */
	slice: number;
}
