/**
 * slugify - 文本转 URL slug
 *
 * 所有非字母数字字符（标点、空格、下划线）合并为单个连字符，去首尾。
 * \p{L}\p{N} 保留 Unicode 字母数字，故支持中文。
 */
export function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
}
