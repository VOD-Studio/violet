# rua self-hosted Runner 安装指南

CI 检查跑在 GitHub-hosted runner；生产部署跑在 rua 上的 self-hosted runner。本指南记录 rua 上一次性接入与日常维护。

## 前置条件

- rua 可访问 `https://github.com`（拉取 runner 发行包与 checkout 代码）。
- rua 已安装 docker 或 podman + docker compose / podman-compose。
- `/root/docker/violet` 已就绪：含 `.env`。

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

### 部署出网

Runner 服务和部署 job 使用 `http://127.0.0.1:20171`，大小写代理变量保持一致。API 的业务外呼仍使用分流端口 `20172`；两端口中的 GitHub、GHCR、GitHub 静态资源和 Azure Blob 日志流量都由 `github-actions` balancer 处理。

仓库脚本 [`scripts/v2ray-feed-fix.py`](../../scripts/v2ray-feed-fix.py) 安装到服务器 `/usr/local/bin/v2ray-feed-fix.py`，由 `v2ray-feed-fix.timer` 每五分钟执行，维护 `/etc/v2raya/config.json`：

- `github-actions` 按 `https://github.com/robots.txt` 的实际可达性选出口，不再固定到单个节点，也不借用 Google 探测结果。
- 节点域名使用 `1.1.1.1` 与 `9.9.9.9` 的 TCP DNS，匹配后不退回普通解析。其他域名保留既有 DNS。
- V2Ray 5.12 的节点拨号须通过 `node-dialer` freedom outbound（`UseIPv4`），并设置 `proxySettings.transportLayer=true` 保留原传输和 TLS。仅设置 `sockopt.domainStrategy` 不会让节点拨号改用内置 DNS。
- 配置变更先通过 `v2ray test`，再原子替换并重载核心；配置未变时不重启。保留 service 的 `KillMode=process`，否则 oneshot 退出可能回收它启动的核心。

改代理前备份配置和维护脚本。重载会中断代理连接，需安排维护窗口；不要重启 API、Web 或数据库来排查 TLS 建连问题。只修改生成的 `config.json` 不足以跨 v2rayA 配置重建保留策略。

在已有维护 service 的服务器上，从仓库根目录更新脚本：

```bash
sudo install -m 0755 scripts/v2ray-feed-fix.py /usr/local/bin/v2ray-feed-fix.py
sudo systemctl start v2ray-feed-fix.service
sudo systemctl is-active v2ray-feed-fix.timer
```

在服务器检查完整链路：

```bash
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://github.com/robots.txt
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://ghcr.io/v2/
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://broker.actions.githubusercontent.com/health
```

依次应为 `200`、`401`、`200`。GHCR 的匿名 `401` 只证明 TLS 与仓库服务可达，不证明发布凭据有效。验证应跨越维护 timer 周期，并确认核心 PID 不变。

## 安全约束

- `deploy.yml` 只在 tag push 与手动 dispatch 时运行，不响应 pull_request，避免在 rua 执行未评审代码。
- runner 进程以受限用户运行，不要用 root 注册。
- 保持 runner 更新：下载新版 actions-runner 包解压覆盖原目录后，执行 `sudo ./svc.sh stop && sudo ./svc.sh install && sudo ./svc.sh start` 重启服务。

## 排错

- **deploy 一直 pending**：runner 离线。检查 `systemctl status`、网络、磁盘空间。
- **checkout 失败**：rua 访问 github.com 超时，检查出网。
- **步骤失败后 job 长时间不结束，日志下载返回 `BlobNotFound`**：读取 `/root/actions-runner/_diag/Worker_*.log` 的 `JobServerQueue`。结果服务或 Azure Blob 不通时，日志上传重试会拖延 job 收尾；只测 `github.com` 不够。
- **migrate 步骤连不上 postgres**：确认 postgres 容器在 `violet_network` 内健康，`.env` 与 `docker-compose.prod.yml` 的 `DATABASE_HOST=postgres` 一致。
