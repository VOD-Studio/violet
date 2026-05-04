/**
 * 通用文件上传 Hook
 * 统一 FileUploader 和 EmojiUploader 的上传逻辑
 */

import { useState, useCallback } from "react";

/** 单个文件上传状态 */
export interface FileUploadItem<T = unknown> {
  /** 临时 ID */
  id: string;
  /** 文件对象 */
  file: File;
  /** 上传进度 0-100 */
  progress: number;
  /** 上传状态 */
  status: "pending" | "uploading" | "done" | "error";
  /** 上传结果 */
  result?: T;
  /** 错误信息 */
  error?: string;
}

/** 文件验证选项 */
export interface FileValidationOptions {
  /** 最大文件大小（字节） */
  maxSize?: number;
  /** 接受的文件类型（MIME 类型） */
  acceptedTypes?: string[];
  /** 自定义验证函数 */
  customValidate?: (file: File) => string | null;
}

/** useFileUpload 配置选项 */
export interface UseFileUploadOptions<T = unknown> {
  /** 文件上传函数 */
  onUpload: (file: File, onProgress?: (progress: number) => void) => Promise<T>;
  /** 上传成功回调 */
  onSuccess?: (result: T, file: File) => void;
  /** 上传失败回调 */
  onError?: (error: Error, file: File) => void;
  /** 文件验证选项 */
  validation?: FileValidationOptions;
  /** 是否支持多文件上传 */
  multiple?: boolean;
  /** 最大文件数量 */
  maxFiles?: number;
}

/**
 * 生成临时唯一 ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 验证文件
 */
function validateFile(
  file: File,
  options?: FileValidationOptions,
): string | null {
  if (!options) return null;

  // 检查文件大小
  if (options.maxSize && file.size > options.maxSize) {
    const maxSizeMB = (options.maxSize / 1024 / 1024).toFixed(1);
    return `文件大小不能超过 ${maxSizeMB}MB`;
  }

  // 检查文件类型
  if (options.acceptedTypes && options.acceptedTypes.length > 0) {
    const isAccepted = options.acceptedTypes.some((type) => {
      if (type.endsWith("/*")) {
        // 通配符类型，如 image/*
        const prefix = type.slice(0, -2);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });

    if (!isAccepted) {
      return "不支持的文件类型";
    }
  }

  // 自定义验证
  if (options.customValidate) {
    return options.customValidate(file);
  }

  return null;
}

/**
 * 通用文件上传 Hook
 *
 * @example
 * ```tsx
 * const { items, handleFiles, removeItem, clearCompleted } = useFileUpload({
 *   onUpload: async (file, onProgress) => {
 *     return await uploadFile(file, onProgress);
 *   },
 *   onSuccess: (result) => {
 *     console.log('Upload success:', result);
 *   },
 *   validation: {
 *     maxSize: 10 * 1024 * 1024, // 10MB
 *     acceptedTypes: ['image/*'],
 *   },
 * });
 * ```
 */
export function useFileUpload<T = unknown>(
  options: UseFileUploadOptions<T>,
) {
  const [items, setItems] = useState<FileUploadItem<T>[]>([]);

  /**
   * 更新指定文件的上传状态
   */
  const updateItem = useCallback(
    (id: string, updates: Partial<FileUploadItem<T>>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  /**
   * 执行单个文件上传
   */
  const uploadSingleFile = useCallback(
    async (item: FileUploadItem<T>) => {
      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        const result = await options.onUpload(item.file, (progress) => {
          updateItem(item.id, { progress });
        });

        updateItem(item.id, { status: "done", progress: 100, result });
        options.onSuccess?.(result, item.file);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("上传失败");
        updateItem(item.id, {
          status: "error",
          error: error.message,
        });
        options.onError?.(error, item.file);
      }
    },
    [updateItem, options],
  );

  /**
   * 处理文件选择
   */
  const handleFiles = useCallback(
    (files: File[]) => {
      // 验证文件
      const validatedFiles: Array<{ file: File; error?: string }> = files.map(
        (file) => ({
          file,
          error: validateFile(file, options.validation) || undefined,
        }),
      );

      // 过滤出有效文件
      const validFiles = validatedFiles.filter((item) => !item.error);

      // 检查文件数量限制
      if (options.maxFiles) {
        const currentCount = items.filter(
          (item) => item.status !== "error",
        ).length;
        const remainingSlots = options.maxFiles - currentCount;

        if (remainingSlots <= 0) {
          options.onError?.(
            new Error(`最多只能上传 ${options.maxFiles} 个文件`),
            files[0],
          );
          return;
        }

        if (validFiles.length > remainingSlots) {
          validFiles.splice(remainingSlots);
          options.onError?.(
            new Error(`已达到文件数量上限，仅上传前 ${remainingSlots} 个文件`),
            files[0],
          );
        }
      }

      // 创建上传项
      const newItems: FileUploadItem<T>[] = validFiles.map(({ file }) => ({
        id: generateId(),
        file,
        progress: 0,
        status: "pending" as const,
      }));

      // 添加验证失败的文件（显示错误）
      const errorItems: FileUploadItem<T>[] = validatedFiles
        .filter((item) => item.error)
        .map(({ file, error }) => ({
          id: generateId(),
          file,
          progress: 0,
          status: "error" as const,
          error,
        }));

      setItems((prev) => [...prev, ...newItems, ...errorItems]);

      // 开始上传有效文件
      for (const item of newItems) {
        uploadSingleFile(item);
      }
    },
    [items, options, uploadSingleFile],
  );

  /**
   * 移除上传项
   */
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * 清空已完成的上传项
   */
  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status !== "done"));
  }, []);

  /**
   * 清空所有上传项
   */
  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  /**
   * 重试失败的上传
   */
  const retryItem = useCallback(
    (id: string) => {
      const item = items.find((item) => item.id === id);
      if (item && item.status === "error") {
        uploadSingleFile(item);
      }
    },
    [items, uploadSingleFile],
  );

  // 统计信息
  const stats = {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    uploading: items.filter((item) => item.status === "uploading").length,
    done: items.filter((item) => item.status === "done").length,
    error: items.filter((item) => item.status === "error").length,
  };

  return {
    /** 上传项列表 */
    items,
    /** 处理文件选择 */
    handleFiles,
    /** 移除指定上传项 */
    removeItem,
    /** 清空已完成的上传项 */
    clearCompleted,
    /** 清空所有上传项 */
    clearAll,
    /** 重试失败的上传 */
    retryItem,
    /** 统计信息 */
    stats,
  };
}
