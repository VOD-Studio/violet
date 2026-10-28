# Nowbeam 接入指南

把站长 Mac 上 Nowbeam 分享的「正在播放、正在使用的应用、窗口标题」显示在站点顶栏。站点自己就是 `nowbeam.v1` 接收端，不需要部署 Nowbeam 独立接收服务（决策见 [ADR-0025](../adr/0025-presence-native-receiver.md)）。

## 1. 部署前提

- API 单实例运行。状态只在进程内存，重启后等客户端重新上报即可恢复。
- 反向代理为 `/api/v1/presence/ingest` 转发 WebSocket 升级头，空闲超时大于 45 秒。生产配置已在 `deploy/nginx/xunrua.top`：

  ```nginx
  location = /api/v1/presence/ingest {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $proxy_connection;
      proxy_read_timeout 90s;
      # 其余 proxy_set_header 与 /api/ 相同
  }
  ```

- 执行迁移 `make migrate`（145 新增设备表、公开设置与 `presence:view` / `presence:manage` 权限，默认授予 admin 角色）。

## 2. 签发设备凭证

1. 后台「平台 → 实时状态」点「签发凭证」，填设备名称（会公开显示，例如 `MacBook Pro`）。
2. 对话框里复制**上报地址**与**设备凭证**。凭证只显示这一次；丢了就撤销该设备再签发。

一台电脑一份凭证。两台电脑共用凭证会互相接管连接（`4002 session_replaced`）。

## 3. 配置 Nowbeam

1. Nowbeam 设置 →「接收端」→ 添加，填入上报地址（`wss://<站点域名>/api/v1/presence/ingest`）与设备凭证。
2. 「检查连接」通过后启用该接收端。
3. 「来源与隐私」按需开启应用、窗口、媒体；窗口标题只对白名单应用生效。
4. 「分享与预览」确认要发送的内容，再点「恢复分享」。Nowbeam 每次启动都会暂停分享，需要重新恢复。

本地联调：Debug 版 Nowbeam 开启回环明文开发选项后，可直接填 `ws://127.0.0.1:9090/api/v1/presence/ingest`。

## 4. 公开展示

后台「实时状态」打开「向访客公开」后，顶栏才会出现状态：桌面在 Logo 胶囊里，移动端在底部导航岛滚动收起后的胶囊里，点开查看详情。关闭时访客看不到任何状态，后台设备列表仍显示在线与正在上报的内容，便于排查。

## 排查

| 现象 | 原因与处理 |
| --- | --- |
| Nowbeam 显示 401 | 凭证错误或已撤销，重新签发 |
| Nowbeam 显示 403 | 请求带了 Origin，检查是否经过会注入 Origin 的代理 |
| 握手失败、显示 400 / 426 | 代理没有转发 `Upgrade` / `Connection` 头 |
| 后台显示在线，访客看不到 | 「向访客公开」未开启 |
| 每隔约 60 秒断线重连 | 代理空闲超时短于 45 秒租约 |
| 锁屏后状态消失但仍在线 | 正常：Nowbeam 锁屏时发送空快照保持在线 |
