/**
 * pdfjs worker 配置（react-pdf v10 + Vite）
 *
 * 早期尝试过 `?url` 和 `new URL(..., import.meta.url)` 两种写法：
 * - `?url`：在 react-pdf + React.lazy 组合下 worker 解析失败（wojtekmaj/react-pdf#1843）
 * - `new URL(..., import.meta.url)`：dev 下 Vite 会把该 .mjs 当普通模块转换，
 *   注入 `import "/@vite/client"`，而该 client 依赖 DOM API，在 Web Worker 上下文
 *   初始化即崩 → pdfjs 回退 fake worker → 渲染失败。prod 构建因产物未被转换而正常，
 *   这也导致该问题长期难以复现。
 *
 * 最终方案：把 worker 作为 public/ 下静态资源，用绝对路径引用。public/ 资源 Vite
 * 原样输出、不做任何转换，dev 与 prod 行为完全一致，且兼容 SSR（TanStack Start）。
 * worker 文件由 package.json 的 postinstall 脚本从 pdfjs-dist 同步，避免版本漂移。
 */
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
