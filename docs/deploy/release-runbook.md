# 发布与回滚手册

## 发版流程（release-please 自动化）

发版由 [release-please](https://github.com/googleapis/release-please) 自动化驱动,从 Conventional Commits 推导版本号并维护 CHANGELOG。

### 日常发版步骤

1. 正常开发,提交发版型 commit（`feat:` / `fix:` / `perf:` / `refactor:` 等）到 `release/2.0`。
   - 纯 `docs:` / `chore:` / `ci:` / `build:` / `test:` 改动不触发新版本（changelog-types 配置为 hidden）。
2. push 到 `release/2.0` 后,release-please 自动开一个「release PR」,标题形如 `chore(release): v2.0.2`,body 含从 commit log 生成的 CHANGELOG 段落。
3. review release PR 的 CHANGELOG 内容,确认无误后**squash merge 合并该 PR**(release PR 固定用 squash 合并,合并 commit 即 `chore(release): vX.Y.Z` 单提交,release-please 据此识别不发新版本;功能/修复 PR 用 merge commit 保留原子提交,见 AGENTS.md「PR 与 issue 规范」)。
4. 合并即触发:release-please 自动打 `vX.Y.Z` tag → 触发 `Deploy` workflow。
5. `Deploy` 自动执行:构建 api+web 镜像 → 数据库迁移门禁 → 部署 api → 健康检查 → 部署 web → 同步静态资源 → 创建 GitHub Release。
6. 在 Actions 页或 `gh run list --workflow=deploy.yml` 观察结果;成功后线上版本写入 `/root/docker/violet/.current-version`。

健康检查失败会自动回滚到 `.current-version` 记录的上一版本;若回滚后仍失败,工作流报错,需人工介入。

### 发版节奏说明

- violet 不做前后端独立版本(ADR-0003 明确不保留向后兼容),api 和 web 同 tag 原子部署,保证契约一致。
- 每次 release PR 合并都会同时构建并部署 api + web,即使本次只改了其中一个(self-hosted runner 有本地镜像层缓存,未改动侧构建会命中缓存,耗时极短)。

## 单组件回滚

出问题时可单独回滚 api 或 web,不需要整体回滚。前提:目标历史 tag 的镜像仍在 rua 本地缓存(docker 不会主动清理)。

### 回滚 api（web 不动）

```bash
# Actions → Deploy → Run workflow
#   version = v2.0.1
#   skip_build = true
#   component = api
```

或命令行:
```bash
gh workflow run deploy.yml -f version=v2.0.1 -f skip_build=true -f component=api
```

### 回滚 web（api 不动）

```bash
gh workflow run deploy.yml -f version=v2.0.1 -f skip_build=true -f component=web
```

### 整体回滚（api + web 都回）

```bash
gh workflow run deploy.yml -f version=v2.0.1 -f skip_build=true -f component=both
```

回滚注意事项:

- 回滚假设 schema 向后兼容。若待回滚的新版本含破坏性迁移（删列、改类型）,回滚前需在 rua 手动 `make migrate-down` 或用 `go run ./cmd/migrate goto <v>`,并人工评审。
- 回滚成功后 `.current-version` 不变（回滚不更新锚点）,便于再次前进。

## 手动重新部署当前版本

不改变版本,只重新构建并部署(如线上配置改动后需重启):

```bash
# Actions → Deploy → Run workflow（不填 version,留空 = 部署当前 HEAD）
# 或:
gh workflow run deploy.yml
```

## 迁移门禁失败处理

迁移 step 失败时 api 容器不会被替换,线上继续跑旧版本。常见原因:

- 迁移 SQL 语法错误:修迁移文件,发新 commit 让 release-please 重开 release PR。
- dirty 状态:在 rua 执行 `docker compose run --rm --no-deps --entrypoint /migrate api version` 查看,必要时 `docker compose run --rm --no-deps --entrypoint /migrate api force <v>` 修复。

## 紧急情况:CI 不可用时的手动兜底

self-hosted runner 离线又急需发版时,用手动流程(独立于 CI):

```bash
make deploy-remote
```

该流程使用 `docker-compose.prod.yml` 自行构建,详见 `manual-deploy.md`。

## 应急:release-please 故障时的手动发版

release-please 本身故障时,可用保留的应急脚本(日常禁用):

```bash
make release-patch    # 从最近 tag 自动 +1
```

注意:这会绕过 release-please 的 release PR review 关卡,仅在紧急情况使用。
