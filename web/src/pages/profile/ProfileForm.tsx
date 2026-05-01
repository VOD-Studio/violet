import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth, useUpdateProfile } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const profileSchema = z.object({
  username: z.string().min(2, "用户名至少 2 个字符").max(50, "用户名最多 50 个字符"),
  bio: z.string().max(200, "简介最多 200 个字符").optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfileForm() {
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username ?? "",
      bio: user?.bio ?? "",
    },
  })

  async function onSubmit(data: ProfileFormData) {
    try {
      await updateProfile.mutateAsync({
        username: data.username,
        bio: data.bio ?? "",
        avatar_url: user?.avatar_url ?? "",
      })
      toast.success("资料更新成功")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input id="username" {...register("username")} />
        {errors.username && (
          <p className="text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" value={user?.email ?? ""} disabled />
        <p className="text-xs text-muted-foreground">邮箱不可修改</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">个人简介</Label>
        <textarea
          id="bio"
          {...register("bio")}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="介绍一下自己..."
        />
        {errors.bio && (
          <p className="text-xs text-destructive">{errors.bio.message}</p>
        )}
      </div>

      <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
        {updateProfile.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        保存修改
      </Button>
    </form>
  )
}
