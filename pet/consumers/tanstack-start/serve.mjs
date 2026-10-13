import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import server from "./dist/server/server.js";

const types = { ".js": "text/javascript", ".wasm": "application/wasm", ".css": "text/css" };
http.createServer(async (req, res) => {
  const file = path.join("dist/client", decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (req.url !== "/" && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  const r = await server.fetch(new Request(`http://localhost:4174${req.url}`, { headers: req.headers }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(4174, () => console.log("up"));
