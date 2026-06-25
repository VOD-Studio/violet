import { useCreatePermission } from "@features/admin-roles/api/mutations";
import { Button } from "@shared/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface CreatePermissionFormProps {
	onCreated: () => void;
}

/**
 * CreatePermissionForm - 创建权限表单
 */
export function CreatePermissionForm({ onCreated }: CreatePermissionFormProps) {
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const createPermission = useCreatePermission();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createPermission.mutate(
			{ code, name, description },
			{
				onSuccess: () => {
					toast.success("权限创建成功");
					onCreated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>新建权限</DialogTitle>
				<DialogDescription>输入权限 code、名称与描述。</DialogDescription>
			</DialogHeader>
			<div className="space-y-3 py-4">
				<div className="space-y-1">
					<Label>Code</Label>
					<Input value={code} onChange={(e) => setCode(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>名称</Label>
					<Input value={name} onChange={(e) => setName(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>描述</Label>
					<Input value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createPermission.isPending}>
					创建
				</Button>
			</DialogFooter>
		</form>
	);
}
