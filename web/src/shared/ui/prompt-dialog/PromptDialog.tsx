/**
 * PromptDialog - 通用输入弹窗（替代原生 window.prompt）
 *
 * 单输入框弹窗，支持 label / 默认值 / 多行（textarea）。
 * 确认时回传输入值；取消或关闭传空（调用方可判断）。
 */
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import { Modal } from "@/shared/ui/modal";
import { Textarea } from "@/shared/ui/base/textarea";

export interface PromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    label?: string;
    /** 默认值 */
    defaultValue?: string;
    placeholder?: string;
    /** 是否多行输入 */
    multiline?: boolean;
    confirmLabel?: string;
    /** 确认回调，返回值即为输入框内容；空字符串表示清空 */
    onConfirm: (value: string) => void;
}

export function PromptDialog({
    open,
    onOpenChange,
    title,
    description,
    label,
    defaultValue = "",
    placeholder,
    multiline = false,
    confirmLabel = "确认",
    onConfirm,
}: PromptDialogProps) {
    const [value, setValue] = useState(defaultValue);

    // 每次打开时重置为默认值
    useEffect(() => {
        if (open) setValue(defaultValue);
    }, [open, defaultValue]);

    const handleConfirm = () => {
        onConfirm(value);
        onOpenChange(false);
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm}>{confirmLabel}</Button>
                </>
            }
        >
            {label ? <Label className="mb-1.5 block">{label}</Label> : null}
            {multiline ? (
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    rows={6}
                    autoFocus
                    className="font-mono text-sm"
                />
            ) : (
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirm();
                    }}
                />
            )}
        </Modal>
    );
}
