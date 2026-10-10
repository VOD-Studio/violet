# 页面转场指南

前台路由切换的转场由 `web/src/shared/lib/view-transition/` 与 `web/src/styles/transitions.css` 共同提供，设计取舍见 [ADR-0020](../adr/0020-route-view-transitions.md)。

## 新页面

不需要做任何事：除后台、实验页与文档站内部外，所有导航默认淡入淡出。需要排除时，在 `rules.ts` 的 `TRANSITION_RULES` 里加一条规则，并在测试里补一对路径。

## 让一对页面共享元素

1. 在 `scopes.ts` 登记这对页面的路由模式，例如 `BLOG_SCOPE = ["/blog", "/blog/$slug"]`。
2. 来源页的链接点击时登记意图：`onClick={() => markSharedSource("cover", post.slug, BLOG_SCOPE)}`。
3. 来源页与目标页各放一个同 `name`、同 `id` 的元素：包一层用 `<SharedElement name="cover" id={post.slug}>`，直接放在已有元素（如 `img`）上用 `useSharedElement` 返回的 `className` 与 `style`。
4. `name` 目前有 `cover` 与 `avatar`，新增种类在 `intent.ts` 的 `SharedName` 里加；动画曲线统一在 `transitions.css` 中以 `.vt-shared` 设定，不需要为每个名字单写。

## 容易写错的地方

- **转场名必须全页唯一。** 重名会让整次转场失败。元素只有在意图匹配时才带转场名，所以正常使用不会重名；但同一实体在来源页出现多次（如同一作者的多条推文）时，登记意图要带上 `instance`，各元素也传相同的 `instance` 来指定被点击的那一个。
- **目标页里会重复出现来源元素的区域，用 `NoSharedElements` 包起来。** 例如用户主页的推文流里，同一作者的头像不能和资料栏头像同名。
- **不要手写 `view-transition-name`。** 一律走 `SharedElement` 或 `useSharedElement`，否则绕过了意图与范围的清理。
- **不要给转场加位移或缩放。** 页面级转场只用透明度；方向性运动只留给共享元素的变形。
- 主题切换的圆形扩散是另一类转场（type 为 `theme`），与页面转场互不影响；它会临时抑制所有命名元素。
- 减弱动态偏好下页面转场直接切换，这由 `transitions.css` 末尾统一处理，新增动画时同样要遵守。
- 只改查询参数或哈希的导航不触发转场。

## 验证

单元测试覆盖规则表、意图整理与共享元素（`shared/lib/view-transition/__tests__`）。转场本身要在真实浏览器里看：在页面里拦截 `document.startViewTransition`，确认类型是 `fade` 或 `morph`、`ready` 与 `finished` 都成功，且参与动画的伪元素里出现预期的 `vt-cover` 或 `vt-avatar` 组。
