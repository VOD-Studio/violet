/**
 * emojis 模块类型定义
 *
 * 领域读模型 Emoji、EmojiGroup、EmojiUploadResult 见 entities/emoji，此处转出供前台消费。
 * 后台写操作请求体见 admin-emojis。
 */
import type { Emoji, EmojiGroup, EmojiUploadResult } from "@entities/emoji/model/types";

// 领域读模型转出
export type { Emoji, EmojiGroup, EmojiUploadResult };
