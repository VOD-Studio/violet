import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useChangePassword } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "请输入当前密码"),
    new_password: z
      .string()
      .min(8, "密码至少需要 8 个字符")
      .regex(/[a-z]/, "密码需包含小写字母")
      .regex(/[A-Z]/, "密码需包含大写字母")
      .regex(/[0-9]/, "密码需包含数字"),
    confirm_password: z.string().min(1, "请确认新密码"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "两次输入的密码不一致",
    path: ["confirm_password"],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

export default function PasswordForm() {
  const changePassword = useChangePassword()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  async function onSubmit(data: PasswordFormData) {
    try {
      await changePassword.mutateAsync({
        old_password: data.old_password,
        new_password: data.new_password,
      })
      toast.success("密码修改成功")
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改失败")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="old_password">当前密码</Label>
        <Input id="old_password" type="password" {...register("old_password")} />
        {errors.old_password && (
          <p className="text-xs text-destructive">{errors.old_password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_password">新密码</Label>
        <Input id="new_password" type="password" {...register("new_password")} />
        {errors.new_password && (
          <p className="text-xs text-destructive">{errors.new_password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">确认新密码</Label>
        <Input id="confirm_password" type="password" {...register("confirm_password")} />
        {errors.confirm_password && (
          <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={changePassword.isPending}>
        {changePassword.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        修改密码
      </Button>
    </form>
  )
}
