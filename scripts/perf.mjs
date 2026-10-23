// Perf profile of the static build (run `npm run build:pages` first): load timings, transfer size
// and battle frame cost on an iPhone 14 profile. CPU throttle via RATE (default 4).
// Needs playwright-core; PW_DIR points at a node_modules containing it.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
import { createRequire } from "node:module";
const require = createRequire((process.env.PW_DIR||"/opt/node-tools/node_modules")+"/");
const { chromium, devices } = require("playwright");
const root = path.resolve("out"), base="/kernel-clash";
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/json",".txt":"text/plain"};
const srv = http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]).replace(base,"")||"/";let f=path.join(root,p);
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html"); if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
 if(!fs.existsSync(f)){r.statusCode=404;return r.end();} const b=fs.readFileSync(f); const gz=zlib.gzipSync(b);
 r.setHeader("content-type",types[path.extname(f)]||"application/octet-stream");r.setHeader("content-encoding","gzip");r.end(gz);}).listen(4173);
const b = await chromium.launch({executablePath:process.env.CHROMIUM||"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const ctx = await b.newContext({...devices["iPhone 14"], serviceWorkers:"block"});
const pg = await ctx.newPage(); const errs=[]; pg.on("console",m=>m.type()==="error"&&errs.push(m.text())); pg.on("pageerror",e=>errs.push(String(e)));
const cdp = await ctx.newCDPSession(pg); await cdp.send("Emulation.setCPUThrottlingRate",{rate:+(process.env.RATE||4)});
let bytes=0; cdp.on?.("Network.dataReceived",e=>bytes+=e.encodedDataLength); await cdp.send("Network.enable");
for (const route of ["/","/map","/battle"]) {
  bytes=0; await pg.goto("http://localhost:4173"+base+route,{waitUntil:"load"});
  await pg.waitForTimeout(route==="/battle"?3000:500);
  const nav = await pg.evaluate(()=>{const n=performance.getEntriesByType("navigation")[0];const fcp=performance.getEntriesByName("first-contentful-paint")[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),fcp:fcp&&Math.round(fcp.startTime)}});
  console.log(route, JSON.stringify(nav), "transferKB", Math.round(bytes/1024));
}
const fr = await pg.evaluate(()=>new Promise(res=>{const d=[];let l=performance.now();let n=0;function f(t){d.push(t-l);l=t;if(++n<180)requestAnimationFrame(f);else{d.shift();d.sort((a,b)=>a-b);res({avg:d.reduce((a,b)=>a+b)/d.length,p95:d[Math.floor(d.length*.95)],max:d.at(-1)})}}requestAnimationFrame(f)}));
console.log("battle frames @4x CPU", JSON.stringify(fr)); console.log("errors",errs);

await b.close(); srv.close();
