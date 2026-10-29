use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::{env, error::Error, fs, path::Path};
use tokio_postgres::{NoTls, Row};

fn timestamp(value: &str) -> DateTime<Utc> {
    value.parse().expect("fixture timestamp")
}

fn close(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() < 0.000_001,
        "{actual} != {expected}"
    );
}

fn event(id: &str, model: &str, occurred_at: &str) -> Value {
    json!({
        "client_event_id": id,
        "provider": "fixture",
        "model": model,
        "input_tokens": 100,
        "output_tokens": 60,
        "cache_read_tokens": 300,
        "cache_write_tokens": 100,
        "reasoning_tokens": 20,
        "cost_total": 0.25,
        "stop_reason": "stop",
        "is_error": false,
        "duration_ms": 2000,
        "ttft_ms": 500,
        "is_subagent": false,
        "omp_version": "18.12.1",
        "occurred_at": occurred_at
    })
}

fn summary(row: &Row, requests: i64, errors: i64, total: f64) {
    assert_eq!(row.get::<_, i64>("requests"), requests);
    assert_eq!(row.get::<_, i64>("errors"), errors);
    close(row.get("total_tokens"), total);
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let root = env::args()
        .nth(1)
        .ok_or("pass the extracted contract directory")?;
    let root = Path::new(&root);
    let sql = |name: &str| fs::read_to_string(root.join("queries").join(name));
    let dsn = env::var("BLOG_TEST_PG_DSN")?;
    let (mut client, connection) = tokio_postgres::connect(&dsn, NoTls).await?;
    let connection_task = tokio::spawn(connection);
    // 整体验收在事务内回滚，不留下表、schema 或测试用户。
    let transaction = client.transaction().await?;
    let schema = format!("omp_usage_consumer_{}", std::process::id());
    transaction.batch_execute(&format!(
        "CREATE SCHEMA {schema}; SET LOCAL search_path TO {schema}; SET LOCAL TIME ZONE 'Pacific/Honolulu';"
    )).await?;
    transaction
        .batch_execute(&fs::read_to_string(root.join("schema.sql"))?)
        .await?;
    let ingest = sql("ingest.sql")?;
    let summary_sql = sql("summary.sql")?;
    let models_sql = sql("models.sql")?;
    let timeseries_sql = sql("timeseries.sql")?;
    let owner = "rust-owner-not-a-uuid";
    let from = timestamp("2026-10-17T00:00:00Z");
    let now = timestamp("2026-10-23T12:30:00Z");
    let first = event("call-1", "alpha", "2026-10-22T12:00:00Z");
    let mut second = event("call-2", "alpha", "2026-10-23T01:00:00Z");
    second["input_tokens"] = json!(200);
    second["output_tokens"] = json!(40);
    second["cache_read_tokens"] = json!(100);
    second["cache_write_tokens"] = json!(0);
    second["reasoning_tokens"] = json!(10);
    second["cost_total"] = json!(0.125);
    second["is_error"] = json!(true);
    second["stop_reason"] = json!("error");
    second["duration_ms"] = Value::Null;
    second["ttft_ms"] = Value::Null;
    let mut third = event("call-3", "beta", "2026-10-22T23:59:59Z");
    third["input_tokens"] = json!(50);
    third["output_tokens"] = json!(20);
    third["cache_read_tokens"] = json!(0);
    third["cache_write_tokens"] = json!(0);
    third["reasoning_tokens"] = json!(0);
    third["cost_total"] = json!(0.025);
    third["duration_ms"] = json!(1200);
    third["ttft_ms"] = json!(200);
    third["is_subagent"] = json!(true);
    let batch = json!([first, second, third, first]);
    let accepted = transaction.query_one(&ingest, &[&owner, &batch]).await?;
    assert_eq!(accepted.get::<_, i64>("accepted"), 3);
    assert_eq!(accepted.get::<_, i64>("duplicated"), 1);
    let replay = transaction.query_one(&ingest, &[&owner, &batch]).await?;
    assert_eq!(replay.get::<_, i64>("accepted"), 0);
    assert_eq!(replay.get::<_, i64>("duplicated"), 4);
    let isolated = transaction
        .query_one(&ingest, &[&"another-owner", &json!([first])])
        .await?;
    assert_eq!(isolated.get::<_, i64>("accepted"), 1);
    let excluded = json!([
        event("before-window", "alpha", "2026-10-16T23:59:59Z"),
        event("after-now", "alpha", "2026-10-23T12:30:01Z")
    ]);
    transaction.query_one(&ingest, &[&owner, &excluded]).await?;
    let overall = transaction
        .query_one(&summary_sql, &[&owner, &from, &now])
        .await?;
    summary(&overall, 3, 1, 970.0);
    close(overall.get("input_tokens"), 350.0);
    close(overall.get("output_tokens"), 120.0);
    close(overall.get("reasoning_tokens"), 30.0);
    close(overall.get("cache_rate"), 400.0 / 850.0);
    close(overall.get("error_rate"), 1.0 / 3.0);
    close(overall.get("api_cost_estimate"), 0.4);
    close(overall.get("avg_duration_ms"), 1600.0);
    close(overall.get("avg_ttft_ms"), 350.0);
    close(overall.get("avg_tokens_per_second"), 30.0);
    let other = transaction
        .query_one(&summary_sql, &[&"another-owner", &from, &now])
        .await?;
    summary(&other, 1, 0, 560.0);
    let empty = transaction
        .query_one(&summary_sql, &[&"empty-owner", &from, &now])
        .await?;
    summary(&empty, 0, 0, 0.0);
    close(empty.get("cache_rate"), 0.0);
    close(empty.get("avg_tokens_per_second"), 0.0);
    let models = transaction
        .query(&models_sql, &[&owner, &from, &now])
        .await?;
    assert_eq!(models.len(), 2);
    assert_eq!(models[0].get::<_, &str>("model"), "alpha");
    summary(&models[0], 2, 1, 900.0);
    close(models[0].get("cost"), 0.375);
    close(models[0].get("avg_tokens_per_second"), 40.0);
    assert_eq!(models[1].get::<_, &str>("model"), "beta");
    summary(&models[1], 1, 0, 70.0);
    assert!(transaction
        .query(&models_sql, &[&"empty-owner", &from, &now])
        .await?
        .is_empty());
    let days = transaction
        .query(&timeseries_sql, &[&owner, &from, &now, &"day"])
        .await?;
    assert_eq!(days.len(), 7);
    assert_eq!(days[0].get::<_, DateTime<Utc>>("timestamp"), from);
    assert_eq!(
        days.iter()
            .map(|row| row.get::<_, i64>("requests"))
            .collect::<Vec<_>>(),
        vec![0, 0, 0, 0, 0, 2, 1]
    );
    assert_eq!(days[6].get::<_, i64>("errors"), 1);
    let hours = transaction
        .query(&timeseries_sql, &[&"empty-owner", &from, &now, &"hour"])
        .await?;
    assert_eq!(hours.len(), 157);
    assert!(hours.iter().all(|row| row.get::<_, i64>("requests") == 0));
    assert_eq!(
        hours[156].get::<_, DateTime<Utc>>("timestamp"),
        timestamp("2026-10-23T12:00:00Z")
    );
    transaction.rollback().await?;
    drop(client);
    connection_task.await??;
    println!("Rust consumer: ingestion/replay, opaque owners, isolation, UTC bounds, missing timings, aggregate parity and zero-filled buckets passed");
    Ok(())
}
