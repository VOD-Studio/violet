import { z } from "zod";

/** 建书/编辑书表单 */
export const seriesSchema = z.object({
	/** 书名 */
	title: z.string().min(1, "书名不能为空").max(255, "书名不能超过 255 个字符"),
	/** slug，创建后不可改 */
	slug: z
		.string()
		.min(1, "slug 不能为空")
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "仅小写字母、数字与连字符"),
	/** 简介（可空） */
	description: z.string().max(2000, "简介不能超过 2000 个字符"),
	/** 封面图 URL（可空） */
	cover_image: z.string(),
});

export type SeriesForm = z.infer<typeof seriesSchema>;
