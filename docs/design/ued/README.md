# Violet UED 设计稿

Claude Design 画布「Violet UED 设计」的原稿快照，2026-11-04 导出。在线稿是只读分享链接，随时可能失效或被改动；本目录是实现时的依据。

- 来源：<https://claude.ai/artifact/SfoRCyVtWY1reJd1mkQXU2>
- 上游版本：`1793774805-94e0`（见 `manifest.json`）
- 画布创建于 2026-10-31

## 内容

| 路径 | 说明 |
|---|---|
| `project/canvas.json` | 画布索引：7 个页面、108 个画板的坐标、尺寸、标题与所属页面 |
| `project/*.dc.html` | 108 个画板原稿，每个文件一个画板 |
| `_blob/` | 画板引用的 47 个资源：亮/暗两张纸面纹理（webp）、3 个字重的 Maple Mono（woff2）、插画 SVG、示例图。文件名是上游资源 ID，原稿以 `/_blob/<id>` 引用 |
| `manifest.json` | 上游版本、每个 `project/` 文件的 sha256（上游清单）、每个 `_blob/` 资源的类型与 sha256（导出时计算） |

画布页面与画板数：

| 页面 | `canvas.json` 的 `page` | 画板数 |
|---|---|---|
| 基础 | `foundation` | 2（基础规范、站点结构） |
| 图标 | `icons` | 1 |
| 组件展示 | `showcase` | 1 |
| 组件 | `components` | 71 |
| 页面 | `site` | 12 |
| 后台 | `admin` | 19 |
| 状态 | `states` | 2（加载、空状态与错误态） |

## 校验

文件与上游逐字节一致，不手改。在本目录下执行，无输出即通过：

```bash
jq -r '.project | to_entries[] | "\(.value)  project/\(.key)"' manifest.json | shasum -a 256 -c --quiet
jq -r '.blobs | to_entries[] | "\(.value.sha256)  _blob/\(.key)"' manifest.json | shasum -a 256 -c --quiet
```

## 阅读与渲染

`.dc.html` 由 Claude Design 运行时（`./support.js`）渲染，运行时随在线稿托管，未归档。没有运行时，文件仍可直接读：内联 CSS、`<x-dc>` 内的模板标记，以及 `<script type="text/x-dc">` 里的取值逻辑（如四季种子色与明暗切换）。

## 未归档

上游导出里下列文件不属于设计内容：`artifact-type/`（查看器应用与运行时，19 个文件）、`SKILL.md`（编辑器的通用操作说明）、`index.html`（查看器入口）。

## 更新

在线稿改动后重新导出整个 `project/` 与 `_blob/`，并重写 `manifest.json`；不要在本目录手改单个文件。
