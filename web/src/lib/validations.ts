/**
 * 统一的表单验证逻辑
 * 提供可复用的验证器函数
 */

export const validators = {
  /**
   * 验证邮箱格式
   */
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || '请输入有效的邮箱地址';
  },

  /**
   * 验证密码强度
   * - 至少 8 个字符
   * - 必须包含大写字母
   * - 必须包含小写字母
   * - 必须包含数字
   */
  password: (value: string) => {
    if (value.length < 8) return '密码至少 8 个字符';
    if (!/[A-Z]/.test(value)) return '密码必须包含大写字母';
    if (!/[a-z]/.test(value)) return '密码必须包含小写字母';
    if (!/[0-9]/.test(value)) return '密码必须包含数字';
    return true;
  },

  /**
   * 验证必填字段
   */
  required: (value: any) => {
    return !!value || '此字段为必填项';
  },

  /**
   * 验证最小长度
   */
  minLength: (min: number) => (value: string) => {
    return value.length >= min || `至少 ${min} 个字符`;
  },

  /**
   * 验证最大长度
   */
  maxLength: (max: number) => (value: string) => {
    return value.length <= max || `最多 ${max} 个字符`;
  },

  /**
   * 验证 URL 格式
   */
  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return '请输入有效的 URL';
    }
  },

  /**
   * 验证 slug 格式
   * 只能包含小写字母、数字和连字符
   */
  slug: (value: string) => {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(value) || '只能包含小写字母、数字和连字符';
  },
};
