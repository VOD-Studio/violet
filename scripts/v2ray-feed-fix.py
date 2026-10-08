#!/usr/bin/env python3
"""每五分钟恢复订阅路由、节点 DNS 与部署出口策略；配置无变化时不重启。"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

CONFIG = "/etc/v2raya/config.json"
CONTAINER = "v2raya"
V2RAY = "/usr/local/bin/v2ray"
CORE_LOG = "/tmp/v2ray-core-managed.log"
FEED_DOMAINS = ["domain:rua.plus", "domain:sspai.com"]
CORE_PATTERN = rf"^{re.escape(V2RAY)} run --config={re.escape(CONFIG)}$"
DEPLOY_DOMAINS = [
    "domain:github.com",
    "domain:githubusercontent.com",
    "domain:ghcr.io",
    "domain:githubassets.com",
    "domain:blob.core.windows.net",
]


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def ensure_deploy_network(config):
    before = json.dumps(config, sort_keys=True)
    nodes = [o for o in config["outbounds"] if o["protocol"] == "vmess"]
    if not nodes:
        raise ValueError("No VMess nodes available for the deployment proxy")
    tags = [o["tag"] for o in nodes]
    hosts = sorted({server["address"] for o in nodes for server in o["settings"]["vnext"]})

    # V2Ray 5.12 的 socket domainStrategy 不控制节点解析，需经 freedom 使用内置 DNS。
    for outbound in config["outbounds"]:
        outbound.get("streamSettings", {}).get("sockopt", {}).pop("domainStrategy", None)
    for node in nodes:
        node["proxySettings"] = {"tag": "node-dialer", "transportLayer": True}
    config["outbounds"] = [o for o in config["outbounds"] if o["tag"] != "node-dialer"]
    config["outbounds"].append({
        "tag": "node-dialer",
        "protocol": "freedom",
        "settings": {"domainStrategy": "UseIPv4"},
        "streamSettings": {"sockopt": {"mark": 128}},
    })

    dns = config.setdefault("dns", {})
    servers = []
    for server in dns.get("servers", []):
        if isinstance(server, dict) and server.get("domains"):
            domains = [d for d in server["domains"] if d.removeprefix("full:") not in hosts]
            if not domains:
                continue
            server["domains"] = domains
        servers.append(server)
    dns["servers"] = [
        {"address": address, "domains": [f"full:{host}" for host in hosts], "skipFallback": True}
        for address in ("tcp://1.1.1.1:53", "tcp://9.9.9.9:53")
    ] + servers
    dns["disableFallbackIfMatch"] = True

    routing = config.setdefault("routing", {})
    routing["rules"] = [
        {"type": "field", "domain": DEPLOY_DOMAINS, "balancerTag": "github-actions"}
    ] + [
        rule for rule in routing.get("rules", [])
        if rule.get("outboundTag") != "github-actions" and rule.get("balancerTag") != "github-actions"
    ]
    routing["balancers"] = [
        balancer for balancer in routing.get("balancers", [])
        if balancer.get("tag") != "github-actions"
    ] + [{
        "tag": "github-actions",
        "selector": tags,
        "strategy": {"type": "leastping", "settings": {"observerTag": "github-actions"}},
    }]
    observers = config.setdefault("multiObservatory", {}).setdefault("observers", [])
    config["multiObservatory"]["observers"] = [
        observer for observer in observers if observer.get("tag") != "github-actions"
    ] + [{
        "tag": "github-actions",
        "settings": {
            "subjectSelector": tags,
            "probeURL": "https://github.com/robots.txt",
            "probeInterval": "5s",
        },
    }]
    return json.dumps(config, sort_keys=True) != before


def main():
    changed = False

    with open(CONFIG) as f:
        c = json.load(f)

    has_rule = any(
        set(r.get("domain", [])) == set(FEED_DOMAINS)
        for r in c.get("routing", {}).get("rules", [])
    )
    if not has_rule:
        proxy_tag = None
        for o in c.get("outbounds", []):
            if o["protocol"] == "vmess" and "日本" in o.get("tag", ""):
                proxy_tag = o["tag"]
                break
        if not proxy_tag:
            for o in c.get("outbounds", []):
                if o["protocol"] == "vmess":
                    proxy_tag = o["tag"]
                    break
        if proxy_tag:
            c.setdefault("routing", {}).setdefault("rules", []).insert(0, {
                "type": "field",
                "outboundTag": proxy_tag,
                "domain": FEED_DOMAINS,
            })
            changed = True
            print(f"Injected routing rule → {proxy_tag}")

    changed = ensure_deploy_network(c) or changed

    if changed:
        with tempfile.NamedTemporaryFile(mode="w", dir=os.path.dirname(CONFIG), suffix=".json",
                                         encoding="utf-8", delete=False) as candidate:
            json.dump(c, candidate, indent=2, ensure_ascii=False)
            candidate_path = candidate.name
        try:
            checked = run(["podman", "exec", CONTAINER, V2RAY, "test", "-c", candidate_path])
            if checked.returncode:
                print("Invalid candidate proxy config; existing config retained", file=sys.stderr)
                return 1
            os.replace(candidate_path, CONFIG)
        finally:
            if os.path.exists(candidate_path):
                os.unlink(candidate_path)

    r = run(["podman", "exec", CONTAINER, "pgrep", "-f", CORE_PATTERN])
    v2ray_running = r.returncode == 0 and bool(r.stdout.strip())

    if changed or not v2ray_running:
        run(["podman", "exec", CONTAINER, "pkill", "-f", CORE_PATTERN])
        time.sleep(2)
        start = run([
            "podman", "exec", "-d", CONTAINER, "sh", "-c",
            f"exec {V2RAY} run --config={CONFIG} >>{CORE_LOG} 2>&1",
        ])
        if start.returncode != 0:
            print(f"FAILED to start v2ray: {start.stderr.strip()}", file=sys.stderr)
            return 1
        time.sleep(3)
        r = run(["podman", "exec", CONTAINER, "pgrep", "-f", CORE_PATTERN])
        running = r.returncode == 0 and bool(r.stdout.strip())
        status = "running" if running else "FAILED"
        print(f"v2ray restarted: {status} (changed={changed}, was_running={v2ray_running})")
        if not running:
            return 1
    else:
        print("OK: routing and node DNS present, v2ray running")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
