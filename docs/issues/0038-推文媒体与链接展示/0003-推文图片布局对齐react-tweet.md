# T3 [react-tweet] 导出 TweetPhotos 并替换推文图片布局

前置：T2（推文 DTO images 已带宽高）。

## 目标

时间线/主页/详情正文区的本站推文图片从 `ImageGrid`（bg-cover 固定裁剪）切换为 `TweetPhotos`（单图保比例、竖图组横向滚动条、其余方格），点击仍走本站灯箱。

## 改动点

- `web/packages/react-tweet/src/unstyled.ts`（及 `index.ts`）：新增导出 `TweetPhotos` 与其 props 类型；组件本体不动。按包规范同步清单/测试。
- `web/src/features/tweets/ui/TweetCardImages.tsx`：组装 `TweetPhoto[]`（url/thumbnailUrl=contentImageUrl 400 宽、width/height），`onOpenPhoto` 接本站 `useImagePreview`（参照 `ExternalTweetCard` 的 openPhoto）；空宽高图直接传 undefined 走包内方格降级。
- `web/src/entities/tweet/model/types.ts` 消费侧适配；引用卡片 `QuotedTweetThumbs`、详情页 `TweetDetailMedia` 不动。
- 既有 `TweetCardImages`/ImageGrid 相关测试按新行为改写；ImageGrid 若因此失去推文消费方仍保留（评论在用）。

## 验收

- 浏览器实测：横图单张保比例不裁剪；两张竖图出同高滚动条（键盘可达）；混合方格；无尺寸历史图退方格；点击开灯箱且不触发卡片导航。
- 包内测试与站点 `web-test`、`web-typecheck`、Biome 全绿；外部 tarball 消费验收按包规范执行（仅当导出面变化触发）。
