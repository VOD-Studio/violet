<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# lib

## Purpose
工具函数和第三方库封装。包含 API 客户端、环境变量、GitHub API、导航配置、SEO 工具、通用工具函数和验证规则。

## Key Files
| File | Description |
|------|-------------|
| `api.ts` | Axios 实例封装 (baseURL、拦截器、认证头) |
| `env.ts` | 环境变量配置 |
| `github.ts` | GitHub API 客户端封装 |
| `navigation.ts` | 导航菜单配置 |
| `seo.ts` | SEO/meta 信息工具 |
| `utils.ts` | 通用工具函数 (含 cn() 类名合并) |
| `validations.ts` | Zod 验证 schema |

## For AI Agents

### Working In This Directory
- `api.ts` 是所有 API 调用的基础，修改需谨慎
- `utils.ts` 中的 `cn()` 是合并 Tailwind 类名的核心工具
- 新增验证规则放在 `validations.ts`
- 新增第三方库封装在此目录

### Common Patterns
- Axios 拦截器: 自动添加 Authorization 头、处理 401 刷新
- cn() = clsx + tailwind-merge，用于组件类名合并
- Zod schema 用于表单验证和 API 响应类型安全

## Dependencies

### External
- Axios - HTTP 客户端
- clsx + tailwind-merge - 类名合并
- Zod - 数据验证

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
