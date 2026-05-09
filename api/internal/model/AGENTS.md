<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/model

## Purpose
跨层共享的数据模型和类型定义。定义业务实体的 Go 结构体。

## Key Files
| File | Description |
|------|-------------|
| `comment.go` | 评论相关模型和枚举 |
| `file.go` | 文件/上传相关模型 |
| `types.go` | 通用类型定义 |

## For AI Agents

### Working In This Directory
- 新增业务实体: 在此定义 Go 结构体
- 模型被 handler/service/repository 三层共享
- JSON tag 用于 HTTP 序列化，db tag 用于数据库映射

### Common Patterns
- 结构体同时带 json 和 db tag
- 枚举使用 const iota 定义
- 时间字段使用 time.Time

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
