import { createContext } from "react";
import type { Locale } from "../locale.ts";

/** 看板的语言；看板里的 `InlineEdit` 等组件据此沿用，不必各自再传 `locale`。 */
export const BoardLocaleContext = createContext<Locale | undefined>(undefined);
