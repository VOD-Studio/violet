// 表单验证 Schema 定义
// 使用 zod 定义登录、注册、邮箱验证等表单的验证规则

import { z } from "zod"

/** 登录表单验证规则 */
export const loginSchema = z.object({
  /** 用户邮箱地址 */
  email: z
    .string()
    .min(1, "请输入邮箱地址")
    .email("请输入有效的邮箱地址"),
  /** 用户密码 */
  password: z
    .string()
    .min(1, "请输入密码"),
})

/** 登录表单数据类型 */
export type LoginFormData = z.infer<typeof loginSchema>

/** 注册表单验证规则 */
export const registerSchema = z
  .object({
    /** 用户名，2-20 个字符 */
    username: z
      .string()
      .min(2, "用户名至少需要 2 个字符")
      .max(20, "用户名最多 20 个字符"),
    /** 用户邮箱地址 */
    email: z
      .string()
      .min(1, "请输入邮箱地址")
      .email("请输入有效的邮箱地址"),
    /** 密码，至少 8 位，需包含大小写字母和数字 */
    password: z
      .string()
      .min(8, "密码至少需要 8 个字符")
      .regex(/[a-z]/, "密码需包含小写字母")
      .regex(/[A-Z]/, "密码需包含大写字母")
      .regex(/[0-9]/, "密码需包含数字"),
    /** 确认密码 */
    confirmPassword: z
      .string()
      .min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

/** 注册表单数据类型 */
export type RegisterFormData = z.infer<typeof registerSchema>

/** 邮箱验证码验证规则 */
export const verifyEmailSchema = z.object({
  /** 6 位数字验证码 */
  code: z
    .string()
    .min(6, "请输入 6 位验证码")
    .max(6, "验证码为 6 位数字")
    .regex(/^\d{6}$/, "验证码只能包含数字"),
})

/** 邮箱验证表单数据类型 */
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>
