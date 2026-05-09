/**
 * 错误处理工具函数
 * 提供统一的错误类型判断和处理逻辑
 */

import { toast } from "sonner";

/** API 错误结构 */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * 判断是否为 ApiError 类型
 * @param err - 待判断的错误对象
 * @returns 是否为 ApiError 类型
 */
export const isApiError = (err: unknown): err is ApiError => {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as ApiError).message === "string"
  );
};

/**
 * 判断是否为标准 Error 类型
 * @param err - 待判断的错误对象
 * @returns 是否为 Error 类型
 */
export const isError = (err: unknown): err is Error => {
  return err instanceof Error;
};

/**
 * 从错误对象中提取错误信息
 * @param err - 错误对象
 * @param defaultMessage - 默认错误信息
 * @returns 提取到的错误信息
 */
export const getErrorMessage = (
  err: unknown,
  defaultMessage: string,
): string => {
  if (isApiError(err)) {
    // 如果有字段级错误，拼接显示
    if (err.errors) {
      const fieldErrors = Object.entries(err.errors)
        .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
        .join("; ");
      return fieldErrors || err.message || defaultMessage;
    }
    return err.message || defaultMessage;
  }

  if (isError(err)) {
    return err.message || defaultMessage;
  }

  if (typeof err === "string") {
    return err || defaultMessage;
  }

  return defaultMessage;
};

/**
 * 统一的 mutation 错误处理函数
 * 自动提取错误信息并显示 toast
 * @param err - 错误对象
 * @param defaultMessage - 默认错误信息
 */
export const handleMutationError = (
  err: unknown,
  defaultMessage: string,
): void => {
  const message = getErrorMessage(err, defaultMessage);
  toast.error(message);
};

/**
 * 统一的 mutation 成功处理函数
 * 显示成功 toast
 * @param message - 成功信息
 */
export const handleMutationSuccess = (message: string): void => {
  toast.success(message);
};
