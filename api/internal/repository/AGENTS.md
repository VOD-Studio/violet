<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/repository

## Purpose
数据访问层，封装所有数据库操作。使用 sqlc 从 SQL 查询自动生成类型安全的 Go 代码。

## Key Files
| File | Description |
|------|-------------|
| `comment_repository.go` | 评论数据访问实现 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `queries/` | sqlc 源 SQL 查询文件 |
| `generated/` | sqlc 自动生成的 Go 代码 (勿手动编辑) |

## For AI Agents

### Working In This Directory
- 新增查询: 在 `queries/` 下编写 SQL 文件，然后运行 `sqlc generate`
- 自定义查询: 在根目录编写 Go 代码补充 sqlc 无法覆盖的场景
- **切勿手动编辑** `generated/` 目录，它会被 sqlc 覆盖
- 数据库迁移在 `../../migrations/` 目录

### Common Patterns
- sqlc 生成: SQL 文件带注释标注查询名和参数
- 复杂查询: 使用 Go 代码手动实现
- 事务: 通过 pgx connection pool 管理

### Testing Requirements
- 测试需连接真实 PostgreSQL (Docker)
- `make reset-db` 重置测试数据库

## Dependencies

### Internal
- `../model/` - 数据模型

### External
- pgx/v5 - PostgreSQL 驱动
- sqlc - 代码生成工具

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
