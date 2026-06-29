/**
 * pdfjs worker 配置（react-pdf v10）
 *
 * react-pdf v10 内部依赖自己的 pdfjs 实例，必须用 react-pdf 导出的 pdfjs
 * 来设置 workerSrc，直接用 pdfjs-dist 的 GlobalWorkerOptions 不生效。
 *
 * 通过 ?url 导入让 Vite 把 worker 作为独立资源处理，避免 fake worker 警告。
 *
 * @see https://github.com/wojtekmaj/react-pdf#how-do-i-make-this-work-with-vite-or-snowpack
 */

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
