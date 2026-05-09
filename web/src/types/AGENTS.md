<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# types

## Purpose
TypeScript 类型定义文件。包含跨模块共享的类型声明和第三方库类型补充。

## Key Files
| File | Description |
|------|-------------|
| `emoji.ts` | Emoji 相关类型定义 |
| `aplayer.d.ts` | APlayer 音乐播放器类型声明 |
| `plyr.d.ts` | Plyr 视频播放器类型声明 |

## For AI Agents

### Working In This Directory
- 新增全局类型定义在此目录
- `.d.ts` 文件用于补充无类型的第三方库
- 领域特定类型可放在对应 features/ 目录

### Common Patterns
- `.d.ts` 用于第三方库类型补充
- `.ts` 用于业务类型定义
- interface 优先于 type

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
