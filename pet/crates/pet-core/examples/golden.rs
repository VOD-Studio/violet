//! 生成黄金出生向量。只在有意提升规则版本并保留旧派生时才重新生成,否则测试 golden_births 必须保持通过。
use pet_core::{derive_birth, BirthInput};

fn main() {
    let mut out = Vec::new();
    for i in 0u8..16 {
        let input = BirthInput {
            world: format!("world-{}", i % 3),
            request_id: format!("request-{i}"),
            server_seed: format!("{:02x}", i.wrapping_mul(17).wrapping_add(1)).repeat(32),
            client_seed: format!("{:02x}", i.wrapping_mul(29).wrapping_add(7)).repeat(32),
            born_at: 0,
        };
        let b = derive_birth(&input).unwrap();
        out.push(serde_json::json!({
            "rules_version": 1,
            "world": input.world, "request_id": input.request_id,
            "server_seed": input.server_seed, "client_seed": input.client_seed,
            "expect": { "id": b.id, "rarity": b.rarity, "species": b.species, "genes": b.genes, "base_traits": b.pet.growth.base_traits },
        }));
    }
    println!("{}", serde_json::to_string_pretty(&out).unwrap());
}
