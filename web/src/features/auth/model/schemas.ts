/**
 * auth 表单 zod schemas
 *
 * 字段规则与后端值对象校验对齐（见 model/types.ts 的字段注释）：
 * - email：标准邮箱格式
 * - username：3-32 字符
 * - password：至少 8 位
 * - code：6 位数字
 *
 * 各 schema 的 infer 类型可直接用于 react-hook-form 的泛型参数。
 */
import { z } from "zod";

/** 邮箱格式（与后端 user.ParseEmail 一致：非空 + 含 @ ） */
export const emailField = z.string().min(1, "请输入邮箱").email("邮箱格式不正确");

/** 用户名：3-32 字符 */
export const usernameField = z
	.string()
	.min(3, "用户名至少 3 个字符")
	.max(32, "用户名最多 32 个字符");

/** 密码：至少 8 位 */
export const passwordField = z.string().min(8, "密码至少 8 位");

/** 6 位数字验证码 */
export const codeField = z
	.string()
	.min(6, "验证码为 6 位数字")
	.max(6, "验证码为 6 位数字")
	.regex(/^\d{6}$/, "验证码只能包含数字");

/** 登录表单：identifier 支持邮箱或用户名，仅校验非空 */
export const loginSchema = z.object({
	identifier: z.string().min(1, "请输入账号"),
	password: z.string().min(1, "请输入密码"),
});

/** 注册表单（含确认密码） */
export const registerSchema = z
	.object({
		email: emailField,
		username: usernameField,
		password: passwordField,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

/** 邮箱验证码表单 */
export const verifyEmailSchema = z.object({
	email: emailField,
	code: codeField,
});

/** 忘记密码表单（仅邮箱） */
export const forgotPasswordSchema = z.object({
	email: emailField,
});

/** 重置密码表单（验证码 + 新密码 + 确认） */
export const resetPasswordSchema = z
	.object({
		email: emailField,
		code: codeField,
		newPassword: passwordField,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
