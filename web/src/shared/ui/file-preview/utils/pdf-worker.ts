/**
 * pdfjs-dist worker 配置
 *
 * react-pdf 在 Vite 下需显式指定 worker URL，否则生产构建报 "fake worker" 警告/错误。
 * 通过 ?url 导入让 Vite 把 worker 作为独立资源处理。
 *
 * @see https://github.com/wojtekmaj/react-pdf#vite
 */
import { GlobalWorkerOptions } from "pdfjs-dist";
// 用 ?url 后缀让 Vite 输出 worker 文件的 URL（而非内联代码）
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
