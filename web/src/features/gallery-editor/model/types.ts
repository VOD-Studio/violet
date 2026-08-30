/** 完整保存中的单张图片输入，数组顺序就是权威顺序。 */
export interface SaveGalleryItemInput {
	file_id: string;
	caption: string;
	alt_text_override: string;
}

/** 图集工作稿完整保存输入。 */
export interface SaveGalleryInput {
	expected_version: number;
	title: string;
	summary: string;
	items: SaveGalleryItemInput[];
}
