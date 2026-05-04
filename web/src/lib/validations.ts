import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "此字段为必填项").email("请输入有效的邮箱地址"),
  password: z.string().min(1, "此字段为必填项"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "用户名至少 3 个字符").max(20, "用户名最多 20 个字符"),
  email: z.string().min(1, "此字段为必填项").email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  confirmPassword: z.string().min(1, "此字段为必填项"),
});

export const verifyEmailSchema = z.object({
  code: z.string().min(6, "验证码为 6 位数字").max(6, "验证码为 6 位数字"),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3, "用户名至少 3 个字符").max(20, "用户名最多 20 个字符"),
  email: z.string().email("请输入有效的邮箱地址"),
  bio: z.string().max(500, "个人简介最多 500 个字符").optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "此字段为必填项"),
  newPassword: z
    .string()
    .min(8, "密码至少 8 个字符")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  confirmPassword: z.string().min(1, "此字段为必填项"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;
