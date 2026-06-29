import { useCreateTag, useUpdateTag } from "@features/tags/api/mutations";
import type { Tag } from "@features/tags/model/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const tagSchema = z.object({
    name: z.string().min(1, "标签名不能为空").max(50, "标签名最多 50 字符"),
});
type TagForm = z.infer<typeof tagSchema>;

interface TagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: Tag | null;
}

export function TagDialog({ open, onOpenChange, editing }: TagDialogProps) {
    const isEdit = !!editing;
    const createTag = useCreateTag();
    const updateTag = useUpdateTag();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<TagForm>({
        resolver: zodResolver(tagSchema),
        defaultValues: { name: "" },
    });

    useEffect(() => {
        if (open) {
            reset({ name: editing?.name || "" });
        }
    }, [open, editing, reset]);

    const onSubmit = (data: TagForm) => {
        if (isEdit && editing?.id) {
            updateTag.mutate(
                { id: editing.id, body: { name: data.name } },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createTag.mutate({ name: data.name }, { onSuccess: () => onOpenChange(false) });
        }
    };

    const pending = createTag.isPending || updateTag.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑标签" : "创建标签"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "修改标签名称（slug 将自动重算）" : "新建一个标签"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tag-name">
                            标签名 <span className="text-destructive">*</span>
                        </Label>
                        <Input id="tag-name" disabled={pending} {...register("name")} />
                        {errors.name && (
                            <p className="text-destructive text-sm">{errors.name.message}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                            {isEdit ? "保存" : "创建"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
