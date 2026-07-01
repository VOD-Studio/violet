import { z } from "zod";

/**
 * postSchema - 文章编辑器表单校验
 *
 * 字段命名对齐后端 CreatePost 的 snake_case，提交与预填免去映射。
 * slug 仅校验非空，格式由 slugify 保证，且允许中文 slug。
 */
export const postSchema = z.object({
    /** 标题，必填 */
    title: z.string().min(1, "请填写标题"),
    /** slug，必填，格式由 slugify 保证 */
    slug: z.string().min(1, "请填写 slug"),
    /** Markdown 正文 */
    content_md: z.string(),
    /** 摘要 */
    excerpt: z.string(),
    /** 封面图 URL */
    cover_image: z.string(),
    /** SEO 标题 */
    seo_title: z.string(),
    /** SEO 描述 */
    seo_description: z.string(),
    /** 标签名列表 */
    tags: z.array(z.string()),
    /** TODO: 是否精选，当前未接入提交，CreatePost 无 is_featured 字段，待后端支持后接入 */
    featured: z.boolean(),
});

/** PostForm - 文章表单类型，由 schema 推导 */
export type PostForm = z.infer<typeof postSchema>;
