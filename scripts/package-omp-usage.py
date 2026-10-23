#!/usr/bin/env python3
"""打包用量 SQL 契约，可在仓库外运行 Rust 消费验收。"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="输出 .tar.gz 路径")
    parser.add_argument("--consumer", action="store_true", help="解包后运行 Rust/PostgreSQL 消费验收，需 BLOG_TEST_PG_DSN")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    source = root / "api/pkg/ompusage"
    schema = source / "schema.sql"
    migration = root / "api/migrations/143_create_omp_usage_events.up.sql"
    if migration.exists() and schema.read_bytes() != migration.read_bytes():
        parser.error("迁移143与共享schema不一致；按包说明重新生成未发布的迁移快照")
    if args.consumer and not os.environ.get("BLOG_TEST_PG_DSN"):
        parser.error("--consumer 需要 BLOG_TEST_PG_DSN；不会跳过真实数据库验收")
    files = [schema, *sorted((source / "queries").glob("*.sql")), *sorted(source.glob("*.json")), source / "README.md"]
    if len(list((source / "queries").glob("*.sql"))) != 4:
        parser.error("缺少摄取、汇总、模型或时间序列 SQL")
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w:gz") as archive:
        for file in files:
            archive.add(file, arcname=Path("omp-usage") / file.relative_to(source))
        archive.add(root / "LICENSE", arcname="omp-usage/LICENSE")
    print(f"契约包：{output}", flush=True)
    if not args.consumer:
        return
    with tempfile.TemporaryDirectory(prefix="omp-usage-consumer-") as directory:
        workspace = Path(directory)
        with tarfile.open(output, "r:gz") as archive:
            archive.extractall(workspace, filter="data")
        fixture = workspace / "rust-consumer"
        shutil.copytree(source / "fixtures/rust-consumer", fixture, ignore=shutil.ignore_patterns("target"))
        subprocess.run(
            ["cargo", "run", "--locked", "--manifest-path", str(fixture / "Cargo.toml"), "--", str(workspace / "omp-usage")],
            check=True,
        )


if __name__ == "__main__":
    main()
