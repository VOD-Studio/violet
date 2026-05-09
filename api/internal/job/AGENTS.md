<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/job

## Purpose
后台定时任务，处理需要异步执行或定期运行的作业。

## Key Files
| File | Description |
|------|-------------|
| `cleanup_job.go` | 清理过期/临时文件的后台任务 |

## For AI Agents

### Working In This Directory
- 新增定时任务: 实现 Job 接口，在 cmd/server/main.go 注册
- 任务应支持优雅停止 (context cancellation)
- 长时间运行的任务需要记录进度

### Common Patterns
- 使用 time.Ticker 或 cron 表达式调度
- context 传递取消信号

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
