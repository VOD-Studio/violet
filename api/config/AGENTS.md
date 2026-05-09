<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# config

## Purpose
应用配置管理，使用 Viper 从环境变量和 config.yaml 加载配置。集中管理数据库、Redis、JWT、邮件、上传等所有配置项。

## Key Files
| File | Description |
|------|-------------|
| `config.go` | Config 结构体定义和加载逻辑 |

## For AI Agents

### Working In This Directory
- 新增配置项: 在 Config 结构体添加字段 + 对应子结构体
- 配置优先级: 环境变量 > config.yaml > 默认值
- 本地开发配置文件: `config.yaml` (gitignored)
- 配置模板: `config.example.yaml`

### Common Patterns
- 结构化配置: DatabaseConfig, RedisConfig, SuperAdminConfig 等子结构体
- 环境变量绑定: Viper AutomaticEnv
- B站 Cookie 自动拼接: BilibiliCookie 由多个环境变量组合

## Dependencies

### External
- spf13/viper - 配置管理

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
