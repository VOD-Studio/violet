use alloc::vec::Vec;
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn mac(key: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut m = HmacSha256::new_from_slice(key).expect("hmac accepts any key length");
    for p in parts {
        m.update(p);
    }
    m.finalize().into_bytes().into()
}

/// RFC 5869 HKDF-SHA256,输出至多 255*32 字节。
pub fn hkdf(salt: &[u8], ikm: &[u8], info: &[u8], len: usize) -> Vec<u8> {
    let prk = mac(salt, &[ikm]);
    let mut out = Vec::with_capacity(len);
    let mut t: Vec<u8> = Vec::new();
    let mut counter = 1u8;
    while out.len() < len {
        let block = mac(&prk, &[&t, info, &[counter]]);
        t = block.to_vec();
        out.extend_from_slice(&block);
        counter += 1;
    }
    out.truncate(len);
    out
}

/// 一条独立随机通道:按标签从同一根材料派生,互不影响。
pub struct Channel {
    bytes: Vec<u8>,
    pos: usize,
}

impl Channel {
    pub fn new(root: &[u8], label: &str) -> Self {
        Self { bytes: hkdf(b"pet/v1", root, label.as_bytes(), 256), pos: 0 }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut b = [0u8; 8];
        b.copy_from_slice(&self.bytes[self.pos..self.pos + 8]);
        self.pos += 8;
        u64::from_be_bytes(b)
    }

    pub fn below(&mut self, n: u64) -> u64 {
        self.next_u64() % n
    }
}
