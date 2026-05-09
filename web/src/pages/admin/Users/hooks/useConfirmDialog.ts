import { useState } from "react";

/**
 * 通用的确认弹窗状态管理 hook
 * 简化多个 useState 管理弹窗状态的问题
 *
 * @example
 * // 定义弹窗状态类型
 * interface DeleteState {
 *   userId: string;
 *   username: string;
 * }
 *
 * // 使用 hook
 * const deleteDialog = useConfirmDialog<DeleteState>({ userId: '', username: '' });
 *
 * // 打开弹窗
 * deleteDialog.open({ userId: '123', username: 'test' });
 *
 * // 关闭弹窗
 * deleteDialog.close();
 *
 * // 访问状态
 * deleteDialog.isOpen; // boolean
 * deleteDialog.state.userId; // string
 */
export function useConfirmDialog<T extends object>(initialState: T) {
  const [state, setState] = useState<{ open: boolean } & T>({
    open: false,
    ...initialState,
  });

  const open = (params: Omit<T, "open">) => {
    setState({ open: true, ...params } as { open: boolean } & T);
  };

  const close = () => {
    setState({ open: false, ...initialState });
  };

  return { state, open, close, isOpen: state.open };
}
