import { fmtBytes, fmtRate } from "../model/format";
import type { Snapshot } from "../model/types";

/** NetworkPanel - 网络接口面板 */
export function NetworkPanel({ data }: { data?: Snapshot }) {
    if (!data) return null;
    const { network } = data;
    return (
        <div className="bg-card rounded-xl border p-4">
            <h3 className="mb-3 font-semibold">网络</h3>
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground text-xs">累计发送</p>
                    <p className="text-sm font-medium">{fmtBytes(network.io.bytesSent)}</p>
                    <p className="text-chart-4 text-xs">{fmtRate(network.io.sendRateBytes)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground text-xs">累计接收</p>
                    <p className="text-sm font-medium">{fmtBytes(network.io.bytesRecv)}</p>
                    <p className="text-chart-2 text-xs">{fmtRate(network.io.recvRateBytes)}</p>
                </div>
            </div>
            <div className="space-y-1">
                {network.interfaces.map((iface) => (
                    <div
                        key={iface.name}
                        className="text-muted-foreground flex justify-between text-xs"
                    >
                        <span>
                            {iface.name} ({iface.addrs[0] ?? "无 IP"})
                        </span>
                        <span>MTU {iface.mtu}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
