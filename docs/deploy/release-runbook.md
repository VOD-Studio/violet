# 后端发布与回滚手册

## 发版流程（打 tag）

1. 确认 `release/2.0` 分支代码已通过 CI（Backend / Frontend 全绿）。
2. 打语义化版本 tag 并推送：
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```
3. `Deploy` 工作流自动触发：构建镜像 → 迁移门禁 → 部署 api → 健康检查 → 创建 GitHub Release。
4. 在 Actions 页或 `gh run list --workflow=deploy.yml` 观察结果；成功后线上版本写入 `/root/docker/mimo-blog/.current-version`。

健康检查失败会自动回滚到 `.current-version` 记录的上一版本；若回滚后仍失败，工作流报错，需人工介入。

## 手动重新部署

```bash
make deploy-ci
# 或：在 Actions → Deploy → Run workflow
```

## 手动回滚

前提：目标历史 tag 的镜像仍在 rua 本地缓存（docker 不会主动清理）。

```bash
make rollback v=v2.0.0
# 或：Actions → Deploy → Run workflow → 填 version=v2.0.0，勾选 skip_build
```

回滚会 checkout 旧 tag、复用缓存镜像、重新迁移（幂等）、重启 api。注意：

- 回滚假设 schema 向后兼容。若待回滚的新版本含破坏性迁移（删列、改类型），回滚前需在 rua 手动 `make migrate-down` 或用 `go run ./cmd/migrate goto <v>`，并人工评审。
- 回滚成功后 `.current-version` 不变（回滚不更新锚点），便于再次前进。

## 迁移门禁失败处理

迁移 step 失败时 api 容器不会被替换，线上继续跑旧版本。常见原因：

- 迁移 SQL 语法错误：修迁移文件，重新打 tag。
- dirty 状态：在 rua 执行 `docker compose run --rm --no-deps api /migrate version` 查看，必要时 `/migrate force <v>` 修复。

## 紧急情况：CI 不可用时的手动兜底

self-hosted runner 离线又急需发版时，用原手动流程（不影响 CI 已配置的内容）：

```bash
make deploy-remote
```

该流程独立于 CI，使用 `docker-compose.prod.yml` 自行构建。
