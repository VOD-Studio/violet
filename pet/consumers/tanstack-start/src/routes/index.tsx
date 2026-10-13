import { createFileRoute } from "@tanstack/react-router";
import { initPet, execute } from "@violet/pet-sdk";
import { useEffect, useState } from "react";

const birth = JSON.stringify({ op: "birth", world: "w1", request_id: "r1", server_seed: "aa".repeat(32), client_seed: "bb".repeat(32), born_at: "0" });

function probe(): string {
  try { execute(birth); return "executed-before-init"; } catch { return "not-initialised"; }
}

function Home() {
  const [id, setId] = useState("pending");
  const ssrProbe = probe(); // 渲染期调用:SSR 与 hydration 首帧都不得已实例化
  useEffect(() => {
    initPet().then(() => setId(JSON.parse(execute(birth)).value.id));
  }, []);
  return (
    <main>
      <p id="probe">{ssrProbe}</p>
      <p id="pet">{id}</p>
    </main>
  );
}

export const Route = createFileRoute("/")({ component: Home });
