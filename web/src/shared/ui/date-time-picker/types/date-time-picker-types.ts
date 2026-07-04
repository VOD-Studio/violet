/**
 * 日期时间选择器模式
 * - date: 仅日期（YYYY-MM-DD）
 * - datetime: 日期+时间（YYYY-MM-DDTHH:mm）
 * - time: 仅时间（HH:mm）
 */
export type DateTimePickerMode = "date" | "datetime" | "time";

/**
 * 日期时间快捷预设项
 */
export interface DateTimePreset {
    /** 预设显示文本 */
    label: string;
    /** 预设值，格式与当前 mode 一致 */
    value: string;
}

/**
 * DateTimePicker 组件属性
 */
export interface DateTimePickerProps {
    /** 当前值，格式由 mode 决定：date=YYYY-MM-DD, datetime=YYYY-MM-DDTHH:mm, time=HH:mm */
    value?: string;
    /** 值变化回调，返回与 mode 对应的格式字符串 */
    onChange?: (value: string) => void;
    /** 选择器模式，默认 datetime */
    mode?: DateTimePickerMode;
    /** 输入框占位符 */
    placeholder?: string;
    /** 是否禁用整个选择器 */
    disabled?: boolean;
    /** 触发按钮/容器的附加类名 */
    className?: string;
    /** 最小可选日期/时间（与 value 同格式） */
    min?: string;
    /** 最大可选日期/时间（与 value 同格式） */
    max?: string;
    /** 自定义禁用日期判断，返回 true 则该日期不可选 */
    disabledDate?: (date: Date) => boolean;
    /** 是否显示清除按钮，默认 true */
    clearable?: boolean;
    /** 快捷预设列表，显示在面板底部 */
    presets?: DateTimePreset[];
}

/**
 * Calendar 日期面板属性
 */
export interface CalendarProps {
    /** 当前选中的日期 */
    selected?: Date | null;
    /** 选中变化回调，返回所选日期的本地 Date 对象 */
    onSelect?: (date: Date) => void;
    /** 当前展示月份（受控），未提供时组件内部自管 */
    month?: Date;
    /** 月份变化回调 */
    onMonthChange?: (month: Date) => void;
    /** 面板附加类名 */
    className?: string;
    /** 是否禁用日期选择及翻月操作 */
    disabled?: boolean;
    /** 最小可选日期 */
    minDate?: Date;
    /** 最大可选日期 */
    maxDate?: Date;
    /** 自定义禁用日期判断 */
    disabledDate?: (date: Date) => boolean;
    /** 每周起始日，0=周日，1=周一，默认 1 */
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * TimePicker 时间选择属性
 */
export interface TimePickerProps {
    /** 当前时间字符串，HH:mm 格式 */
    value?: string;
    /** 时间变化回调 */
    onChange?: (time: string) => void;
    /** 是否禁用 */
    disabled?: boolean;
}

/**
 * DateTimePickerField 表单字段属性
 */
export interface DateTimePickerFieldProps extends Omit<DateTimePickerProps, "className"> {
    /** 关联 label 的 id */
    id?: string;
    /** 标签文本 */
    label: React.ReactNode;
    /** 校验错误提示 */
    error?: string;
}
