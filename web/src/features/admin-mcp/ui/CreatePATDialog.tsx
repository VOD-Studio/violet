import { useCreatePAT } from "@features/admin-mcp/api/queries";
import { type CreatePATRequest, PAT_SCOPES, type PATScope } from "@features/admin-mcp/model/types";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { DateTimePicker } from "@shared/ui/date-time-picker/components/DateTimePicker";
import type { DateTimePreset } from "@shared/ui/date-time-picker/types/date-time-picker-types";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface CreatePATDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (token: string) => void;
}

export function CreatePATDialog({ open, onOpenChange, onCreated }: CreatePATDialogProps) {
    const create = useCreatePAT();
    const [name, setName] = React.useState("");
    const [scopes, setScopes] = React.useState<Set<PATScope>>(new Set(["posts:read"]));
    const [expiresAt, setExpiresAt] = React.useState("");

    const expiryPresets: DateTimePreset[] = React.useMemo(() => {
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const now = new Date();
        const addDays = (n: number) => {
            const x = new Date(now);
            x.setDate(x.getDate() + n);
            return fmt(x);
        };
        return [
            { label: "90 天", value: addDays(90) },
            { label: "365 天", value: addDays(365) },
            { label: "永不过期", value: "never" },
        ];
    }, []);

    React.useEffect(() => {
        if (open) {
            setName("");
            setScopes(new Set(["posts:read"]));
            setExpiresAt("");
        }
    }, [open]);

    const toggleScope = (s: PATScope) => {
        setScopes((prev) => {
            const next = new Set(prev);
            if (next.has(s)) {
                next.delete(s);
            } else {
                next.add(s);
            }
            return next;
        });
    };

    const submit = () => {
        if (!name.trim()) {
            toast.error("请填写令牌名称");
            return;
        }
        if (scopes.size === 0) {
            toast.error("至少选择一个权限");
            return;
        }
        const body: CreatePATRequest = {
            name: name.trim(),
            scopes: [...scopes],
            expires_at: expiresAt,
        };
        create.mutate(body, {
            onSuccess: (dto) => {
                if (dto.token) {
                    onCreated(dto.token);
                }
            },
        });
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="创建访问令牌"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={create.isPending}
                    >
                        取消
                    </Button>
                    <Button onClick={submit} disabled={create.isPending}>
                        {create.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
                        创建
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pat-name">
                        名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="pat-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="如：Claude Desktop"
                        disabled={create.isPending}
                    />
                </div>
                <div className="space-y-2">
                    <Label>
                        权限范围 <span className="text-destructive">*</span>
                    </Label>
                    <div className="space-y-2">
                        {PAT_SCOPES.map((s) => (
                            <label
                                key={s}
                                htmlFor={`pat-scope-${s}`}
                                className="flex cursor-pointer items-center gap-2"
                            >
                                <Checkbox
                                    id={`pat-scope-${s}`}
                                    checked={scopes.has(s)}
                                    onCheckedChange={() => toggleScope(s)}
                                    disabled={create.isPending}
                                />
                                <Label
                                    htmlFor={`pat-scope-${s}`}
                                    className="cursor-pointer font-mono text-sm"
                                >
                                    {s}
                                </Label>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>有效期</Label>
                    <DateTimePicker
                        value={expiresAt}
                        onChange={setExpiresAt}
                        mode="date"
                        placeholder="留空默认 90 天"
                        disabled={create.isPending}
                        clearable
                        presets={expiryPresets}
                    />
                </div>
            </div>
        </Modal>
    );
}
