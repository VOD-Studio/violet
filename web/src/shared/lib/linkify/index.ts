/**
 * linkify - 通用 URL 识别 tokenizer
 *
 * 从纯文本切出 URL 段并生成安全的 `<a>` 展示数据；与后端
 * `application/tweet/urls.go` 的 ExtractURLs 保持同一规则集。
 */
export { displayUrl, tokenizeLinks } from "./linkify";
export type { LinkifyMatch } from "./linkify";
