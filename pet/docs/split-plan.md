# 拆分为独立仓库的计划

#517 的一部分。**尚未执行**：创建仓库是对外部的、难以撤回的动作，需要有人明确决定时机与仓库名。本文只保证“一条命令可执行，历史不丢”，并列出迁移清单。

## 为什么必须从 PR 的原始提交拆

PR #516 是 squash 合并，`release/2.0` 上 `pet/` 的历史只有一个压缩提交。直接从 `release/2.0` 拆会丢掉全部原子提交。PR 的原始头部仍保存在 GitHub 的 `refs/pull/<n>/head`，从那里拆能保留历史。后续用 squash 合并的 PR 同理。

已验证（只在本地，未推送）：把 PR #535 的提交重放到 `refs/pull/516/head` 上，再对 `pet/` 做 subtree split，得到 **34 个提交**，文件树与当前分支的 `pet/` 逐文件一致，不含 `web/`、`api/`、`.github/`。

## 执行步骤

```sh
# 1. 取得 PR 的原始头部（squash 前的提交）
git fetch origin refs/pull/516/head:refs/tmp/pr516

# 2. 在临时 worktree 里把之后的 pet 相关 PR 重放到它上面
git worktree add -b tmp/full-history ../pet-split refs/tmp/pr516
cd ../pet-split
git cherry-pick -X theirs $(git rev-list --reverse origin/release/2.0..<后续 PR 分支>)

# 3. 校验文件树一致（输出必须为空）
git diff --stat tmp/full-history <后续 PR 分支> -- pet

# 4. 拆出 pet/ 的历史
git subtree split --prefix=pet tmp/full-history -b pet-split

# 5. 推到新仓库
git push <新仓库地址> pet-split:main
```

`-X theirs` 可能掩盖冲突，所以第 3 步的树比较不能省。若之后的 PR 又被 squash，需要把它们的原始头部一并按顺序重放。

## 随新仓库迁出

| 内容 | 位置 |
|---|---|
| 规则核心、存储、帧合成、签发、schema、CLI、WebAssembly 包装 | `pet/crates/` |
| SDK 与 CLI 的 npm 打包 | `pet/packages/` |
| 素材清单与参数文档 | `pet/catalog/`、`pet/docs/` |
| 场景、脚本、外部消费验收 | `pet/scenario/`、`pet/scripts/`、`pet/consumers/` |
| 检查工作流 | `.github/workflows/pet.yml`，迁入新仓库并去掉 pick-runner 依赖或一并迁移 |

## 留在 Violet

PRD-0036、ADR-0021、CONTEXT 中的术语、Violet 活动连接器（#528）、主页挂载（#531）。迁出后删除 `pet/` 与 `pet.yml`，PRD 中的路径引用改为新仓库链接。

## 迁移清单

- [ ] 确定仓库名与可见性（R-08：npm 为 `@violetjs/pet*`，crate 为 `violet-pet-*`）
- [ ] 按上面步骤拆分并校验树一致
- [ ] 新仓库配置 CI：安装 `wasm-bindgen-cli@0.2.129`、Postgres 服务、Chrome；`RUNNER_STATUS_TOKEN` 与 `SELF_HOSTED_RUNNER` 是否沿用另议
- [ ] 新仓库首次 CI 全绿后，再从 Violet 删除 `pet/` 与 `pet.yml`
- [ ] 转移下游 issue（#525 至 #540）：`gh issue transfer <n> <新仓库>`；评审类 issue（#518 至 #524）按内容决定留在 Violet 还是迁出
- [ ] 更新 PRD、ADR 与 CONTEXT 中的路径和链接
- [ ] npm 与 crates.io 的发布流程与令牌（目前没有任何包发布）
- [ ] 许可文件：`LICENSE` 随仓库根，素材许可另附

## 不在本文范围

仓库创建、命名投票、发布令牌与组织权限，这些需要有权限的人决定与操作。
