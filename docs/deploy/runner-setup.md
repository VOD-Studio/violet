# rua self-hosted Runner 安装指南

CI 检查跑在 GitHub-hosted runner；生产部署跑在 rua 上的 self-hosted runner。本指南记录 rua 上一次性接入与日常维护。

## 前置条件

- rua 可访问 `https://github.com`（拉取 runner 发行包与 checkout 代码）。
- rua 已安装 docker 或 podman + docker compose / podman-compose。
- `/root/docker/mimo-blog` 已就绪：含 `api/.env`。

## 注册 runner

1. 仓库 Settings → Actions → Runners → New self-hosted runner → Linux。
2. 在 rua 按 GitHub 给出的命令下载、解压、配置：
   ```bash
   cd /root/actions-runner
   ./config.sh --url https://github.com/<owner>/<repo> --token <token> --labels "rua"
   ```
   关键：`--labels "rua"`，`deploy.yml` 用 `runs-on: [self-hosted, rua]` 精确匹配。
3. 注册时交互项：runner 名随意；工作目录用默认 `_work`；label 已由参数指定。
4. 安装为 systemd 服务，保证开机自启与崩溃重启：
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

## 验证

- GitHub 仓库 Settings → Actions → Runners 出现 Idle 状态、带 `self-hosted` 与 `rua` 两个 label 的条目。
- rua 上 `sudo systemctl status actions.runner.*` 为 active (running)。

## 安全约束

- `deploy.yml` 只在 tag push 与手动 dispatch 时运行，不响应 pull_request，避免在 rua 执行未评审代码。
- runner 进程以受限用户运行，不要用 root 注册。
- 保持 runner 更新：下载新版 actions-runner 包解压覆盖原目录后，执行 `sudo ./svc.sh stop && sudo ./svc.sh install && sudo ./svc.sh start` 重启服务。

## 排错

- **deploy 一直 pending**：runner 离线。检查 `systemctl status`、网络、磁盘空间。
- **checkout 失败**：rua 访问 github.com 超时，检查出网。
- **migrate 步骤连不上 postgres**：确认 postgres 容器在 `blog_network` 内健康，`api/.env` 与 `docker-compose.prod.yml` 的 `DATABASE_HOST=postgres` 一致。
