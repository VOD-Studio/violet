//! 浮点确定性:规则核心不做浮点运算(clippy 强制),这里再保证浮点不可能从输入进入状态。
//! serde_json 内部含浮点解析代码,但所有数值字段都是整数类型,输入里出现浮点会被拒绝。
use pet_core::execute;
use serde_json::{json, Value};

fn run(v: Value) -> Value {
    serde_json::from_str(&execute(&v.to_string())).unwrap()
}

fn newborn() -> Value {
    let b = run(json!({"op":"birth","world":"w","request_id":"r","server_seed":"aa".repeat(32),"client_seed":"bb".repeat(32),"born_at":"0"}));
    b["value"]["pet"].clone()
}

#[test]
fn floats_in_integer_fields_are_rejected_as_bad_input() {
    for (field, bad) in [("satiety", json!(80.5)), ("food", json!(1e2)), ("energy", json!(79.0)), ("medicine", json!(-0.0))] {
        let mut pet = newborn();
        pet[field] = bad.clone();
        let r = run(json!({"op":"act","pet":pet,"action":"wait","now":"10","request_id":"x"}));
        assert_eq!(r["ok"], false, "{field}={bad}");
        assert_eq!(r["code"], "bad_input", "{field}={bad}");
    }
}

#[test]
fn floats_in_nested_arrays_are_rejected() {
    let mut pet = newborn();
    pet["growth"]["traits"] = json!([500.5, 500, 500]);
    let r = run(json!({"op":"act","pet":pet,"action":"wait","now":"10","request_id":"x"}));
    assert_eq!(r["code"], "bad_input");
    let r = run(json!({"op":"frame","species":1,"genes":[1,2,3,4,5,6,7,8.5],"pose":"idle","charset":"ascii","w":10,"h":3,"t":"0"}));
    assert_eq!(r["code"], "bad_input");
}

#[test]
fn sixty_four_bit_values_must_be_strings() {
    let pet = newborn();
    // 数值形式的 u64 会被拒绝(可能是浮点,也不是约定的字符串编码)。
    let r = run(json!({"op":"act","pet":pet,"action":"wait","now":10,"request_id":"x"}));
    assert_eq!(r["code"], "bad_input");
}

#[test]
fn outputs_never_contain_a_float() {
    let pet = newborn();
    let r = run(json!({"op":"act","pet":pet,"action":"wait","now":"100000","request_id":"x"}));
    fn walk(v: &Value) {
        match v {
            Value::Number(n) => assert!(n.is_u64() || n.is_i64(), "float in output: {n}"),
            Value::Array(a) => a.iter().for_each(walk),
            Value::Object(o) => o.values().for_each(walk),
            _ => {}
        }
    }
    walk(&r);
}
