/**
 * 显示名上限，对齐后端 `api/internal/domain/chat/bot.go` 的 MaxBotNameLength。
 *
 * @remarks 该值是 bot 名与虚拟用户 display_name 两个上限的交集，改一侧必须改另一侧。
 */
export const BOT_NAME_MAX = 32;
