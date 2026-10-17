import { createContext } from "react";

/** 批注暂时离屏或关闭尾帧时，停用其输入控件与嵌套浮层，不销毁草稿。 */
export const AnnotationOverlayContext = createContext(true);
