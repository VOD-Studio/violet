#!/usr/bin/env python3
"""Only build failures may be retried without operator intervention."""

import argparse
import json
import os
import subprocess
import time


def retry_reason(run, jobs):
    if run.get("path", "").split("@")[0] != ".github/workflows/deploy.yml":
        return "指定 run 不是 Deploy 工作流"
    if run.get("status") != "completed" or run.get("conclusion") != "failure":
        return "run 未以失败结束"
    if run.get("event") != "push":
        return "手动部署或回滚不自动重试"
    if run.get("run_attempt", 0) >= 3:
        return "已达到三次尝试上限"
    failed = {job["name"] for job in jobs if job.get("conclusion") == "failure"}
    if not failed or not failed.issubset({"build-api", "build-web"}):
        return "只有镜像构建失败可自动重试；检查、迁移与生产切换需人工处理"
    if any(job.get("conclusion") == "cancelled" for job in jobs):
        return "包含已取消的 job，不覆盖人工取消决定"
    return None


def gh_json(*args):
    return json.loads(subprocess.check_output(["gh", *args], text=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_id", type=int)
    parser.add_argument("--immediate", action="store_true")
    args = parser.parse_args()
    repo = os.environ["GH_REPO"]
    endpoint = f"repos/{repo}/actions/runs/{args.run_id}"
    run = gh_json("api", endpoint)
    pages = gh_json("api", "--paginate", "--slurp", endpoint + "/jobs?filter=latest&per_page=100")
    jobs = [job for page in pages for job in page["jobs"]]
    reason = retry_reason(run, jobs)
    if reason:
        print(reason)
        return
    if not args.immediate:
        time.sleep(60 * run["run_attempt"])
    current = gh_json("api", endpoint)
    if current["run_attempt"] != run["run_attempt"] or current["status"] != "completed":
        print("run 已被其他操作重试，跳过重复请求")
        return
    subprocess.run(["gh", "run", "rerun", str(args.run_id), "--failed"], check=True)


if __name__ == "__main__":
    main()
