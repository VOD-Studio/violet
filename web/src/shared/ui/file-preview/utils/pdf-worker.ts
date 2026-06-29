/**
 * pdfjs worker 配置（react-pdf v10 + Vite）
 *
 * react-pdf v10 在 Vite + React.lazy 组合下用 ?url 导入 worker 会失败
 * （wojtekmaj/react-pdf#1843）。改用 Vite 官方推荐的 new URL(..., import.meta.url)
 * 方式，Vite 会正确处理 worker 资源的产出与引用。
 *
 * @see https://vite.dev/guide/assets#new-url-url-import-meta-url
 * @see https://github.com/wojtekmaj/react-pdf/issues/1843
 */
import { pdfjs } from "react-pdf";

// Vite 会把 worker 作为独立 chunk 产出，运行时解析为正确的绝对 URL
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString();
