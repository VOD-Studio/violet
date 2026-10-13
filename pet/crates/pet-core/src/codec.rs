use alloc::string::String;
use alloc::vec::Vec;
use serde::Serialize;

/// 成功响应信封。
#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema), schemars(rename = "{T}Result"))]
pub struct OkBody<T> {
    pub ok: bool,
    pub value: T,
}

/// 失败响应信封;`code` 取值见各动作的错误分类。
#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct ErrorBody {
    pub ok: bool,
    pub code: String,
    pub message: String,
}

pub fn ok<T: Serialize>(v: &T) -> String {
    #[derive(Serialize)]
    struct Borrowed<'a, T> {
        ok: bool,
        value: &'a T,
    }
    serde_json::to_string(&Borrowed { ok: true, value: v }).unwrap_or_default()
}

pub fn error(code: &str, message: &str) -> String {
    #[derive(Serialize)]
    struct Borrowed<'a> {
        ok: bool,
        code: &'a str,
        message: &'a str,
    }
    serde_json::to_string(&Borrowed { ok: false, code, message }).unwrap_or_default()
}

pub fn hex(bytes: &[u8]) -> String {
    const H: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(H[(b >> 4) as usize] as char);
        s.push(H[(b & 15) as usize] as char);
    }
    s
}

pub fn unhex(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return None;
    }
    let nib = |c: u8| match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        _ => None,
    };
    s.as_bytes()
        .chunks(2)
        .map(|p| Some(nib(p[0])? << 4 | nib(p[1])?))
        .collect()
}

/// u64 线上编码为十进制字符串,避开 JavaScript 安全整数范围。
pub mod u64_string {
    use alloc::string::{String, ToString};
    use serde::{de::Error, Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(v: &u64, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&v.to_string())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        let s = String::deserialize(d)?;
        s.parse().map_err(D::Error::custom)
    }
}
