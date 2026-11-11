/** 编辑器需要的内联表情显示模型，不包含分组、权限或服务端 DTO。 */
export interface InlineEmoji {
	token: string;
	src?: string;
	text?: string;
	size?: number;
}
