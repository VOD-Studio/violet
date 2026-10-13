use pet_core::{growth::EvolutionOptions, proof::Verdict, Birth, CapabilityCatalog, Command, ErrorBody, OkBody, Outcome};
use pet_term::Frame;
use schemars::generate::SchemaSettings;
use serde_json::{json, Value};

/// 每个 op 对应的成功响应类型;命令变体与此表的一致性由测试保证。
const OP_RESULTS: [(&str, &str); 7] = [
    ("grant", "OutcomeResult"),
    ("evolution_options", "EvolutionOptionsResult"),
    ("capabilities", "CapabilityCatalogResult"),
    ("birth", "BirthResult"),
    ("act", "OutcomeResult"),
    ("frame", "FrameResult"),
    ("verify_birth", "VerdictResult"),
];

fn bundle() -> Value {
    let mut g = SchemaSettings::draft2020_12().into_generator();
    g.subschema_for::<Command>();
    g.subschema_for::<OkBody<Birth>>();
    g.subschema_for::<OkBody<Outcome>>();
    g.subschema_for::<OkBody<Frame>>();
    g.subschema_for::<OkBody<Verdict>>();
    g.subschema_for::<OkBody<CapabilityCatalog>>();
    g.subschema_for::<OkBody<EvolutionOptions>>();
    g.subschema_for::<ErrorBody>();
    let defs = g.take_definitions(true);
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "pet wire protocol",
        "$defs": defs,
        "x-capabilities": pet_core::catalog(),
        "x-op-results": OP_RESULTS.iter().map(|(k, v)| (k.to_string(), json!(v))).collect::<serde_json::Map<_, _>>(),
    })
}

fn main() {
    println!("{}", serde_json::to_string_pretty(&bundle()).expect("schema is serializable"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use pet_core::CAPABILITIES;

    #[test]
    fn op_table_matches_command_variants() {
        let b = bundle();
        let cmd = serde_json::to_string(&b["$defs"]["Command"]).unwrap();
        for (op, result) in OP_RESULTS {
            assert!(cmd.contains(&format!("\"{op}\"")), "Command has no op {op}");
            assert!(b["$defs"].get(result).is_some(), "missing definition {result}");
        }
        let catalog_ops: Vec<&str> = CAPABILITIES.iter().map(|c| c.op).collect();
        let mut table_ops: Vec<&str> = OP_RESULTS.iter().map(|(o, _)| *o).collect();
        table_ops.sort();
        let mut sorted = catalog_ops.clone();
        sorted.sort();
        assert_eq!(sorted, table_ops, "capability catalog and OP_RESULTS must list the same ops");
        let variants = b["$defs"]["Command"]["oneOf"].as_array().expect("tagged enum").len();
        assert_eq!(variants, OP_RESULTS.len(), "new Command variant needs an OP_RESULTS entry");
    }
}
