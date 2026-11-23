(()=>{"use strict";(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,25876,e=>{var t=e.i(43476),r=e.i(22016),a=e.i(71645),n=e.i(50395);let o={"==":(e,t)=>e===t,"!=":(e,t)=>e!==t,"<":(e,t)=>e<t,"<=":(e,t)=>e<=t,">":(e,t)=>e>t,">=":(e,t)=>e>=t},s=e=>JSON.stringify(Object.entries(e).sort(([e],[t])=>e<t?-1:1)),l=e=>[e.pc.join(","),e.regs.map(s).join("|"),s(e.vars),s(e.locks),s(e.sems),JSON.stringify(e.blocked)].join("#"),i=e=>({pc:[...e.pc],regs:e.regs.map(e=>({...e})),vars:{...e.vars},locks:{...e.locks},sems:{...e.sems},blocked:[...e.blocked]}),c=e=>!e.failure&&!e.deadlock&&!e.truncated&&e.finals.length>0&&!e.starvation,u=/^[A-Za-z_]\w*$/,d=/^r\d*$/,f=["==","!=","<=",">=","<",">"];function p(e){let t=function(e){let t={},r={},a=[],n=!1,o=0,s=e=>({ok:!1,error:{line:o,message:e}}),l=e=>/^-?\d+$/.test(e)?Number(e):null,i=e=>l(e)??(u.test(e)?e:null);for(let c of e.split("\n")){o++;let e=c.replace(/#.*/,"").trim();if(!e)continue;let p=e.split(/\s+/),h=a[a.length-1];if("spurious"===p[0]&&1===p.length){n=!0;continue}if(("var"===p[0]||"sem"===p[0])&&4===p.length&&"="===p[2]){let e=l(p[3]);if(!u.test(p[1])||null===e)return s(`expected "${p[0]} name = number"`);if("sem"===p[0]&&e<0)return s("a semaphore cannot start negative");("var"===p[0]?t:r)[p[1]]=e;continue}if("thread"===p[0]){if(2!==p.length||!u.test(p[1]))return s('expected "thread NAME"');if(a.length>=3)return s("at most 3 threads");if(a.some(e=>e.name===p[1]))return s(`thread ${p[1]} is already defined`);a.push({name:p[1],code:[]});continue}if(!h)return s('start with "thread NAME" before statements');if(h.code.length>=20)return s("at most 20 statements per thread");let m=e=>(h.code.push(e),null),g=e=>void 0!==e&&u.test(e)?e:null,k=null,[x,b,y]=p;if("lock"===x||"unlock"===x){let e=g(b);k=2===p.length&&e?m({op:x,m:e}):`expected "${x} NAME"`}else if("wait"===x||"post"===x){let e=g(b);k=2===p.length&&e?e in r?m({op:x,s:e}):`declare it first: sem ${e} = 1`:`expected "${x} NAME"`}else if("signal"===x||"broadcast"===x){let e=g(b);k=2===p.length&&e?m({op:x,c:e}):`expected "${x} NAME"`}else if("cwait"===x){let e=g(b),t=g(y);k=3===p.length&&e&&t?m({op:"cwait",c:e,m:t}):'expected "cwait COND MUTEX"'}else if("goto"===x){let e=g(b);k=2===p.length&&e?m({op:"jmp",to:e}):'expected "goto LABEL"'}else if("if"===x||"assert"===x){let e=i(p[1]??""),t=p[2],r=i(p[3]??"");if(null!==e&&null!==r&&t&&f.includes(t))if("assert"===x)k=4===p.length?m({op:"assert",a:e,cmp:t,b:r}):'expected "assert a == b"';else{let a=g(p[5]);k=6===p.length&&"goto"===p[4]&&a?m({op:"if",a:e,cmp:t,b:r,to:a}):'expected "if a == b goto LABEL"'}else k=`expected "${x} a == b${"if"===x?" goto L":""}"`}else if(1===p.length&&/^[A-Za-z_]\w*:$/.test(x))k=m({op:"label",name:x.slice(0,-1)});else if(3===p.length&&"="===b&&u.test(x)){let e=i(y);k=null===e?"the right side must be a name or a number":d.test(x)?"string"!=typeof e||d.test(e)?'a register is loaded from a shared variable: "r = x"':m({op:"load",reg:x,v:e}):m("string"==typeof e&&d.test(e)?{op:"store",v:x,reg:e}:{op:"set",v:x,to:e})}else k=3===p.length&&"+="===b&&u.test(x)&&null!==l(y)?m(d.test(x)?{op:"add",reg:x,k:l(y)}:{op:"inc",v:x,k:l(y)}):`cannot read "${e}"`;if(k)return s(k)}if(!a.length)return{ok:!1,error:{line:1,message:"define at least one thread"}};for(let e of a){let t=new Set(e.code.filter(e=>"label"===e.op).map(e=>e.name));for(let r of e.code)if(("if"===r.op||"jmp"===r.op)&&"string"==typeof r.to&&!t.has(r.to))return{ok:!1,error:{line:1,message:`thread ${e.name}: no label "${r.to}"`}};if(t.size!==e.code.filter(e=>"label"===e.op).length)return{ok:!1,error:{line:1,message:`thread ${e.name}: duplicate label`}}}return{ok:!0,program:{vars:t,sems:r,threads:a,spurious:n,maxStates:6e4}}}(e);if(!t.ok)return t;try{return{ok:!0,report:function(e){let t=e.threads.map(e=>(function(e){let t={},r=0;for(let a of e)if("label"!==a.op)r++;else if(a.name in t)throw Error(`duplicate label ${a.name}`);else t[a.name]=r;let a=e=>{if("number"==typeof e)return e;if(!(e in t))throw Error(`unknown label ${e}`);return t[e]},n=[];for(let t of e)"label"!==t.op&&n.push("if"===t.op||"jmp"===t.op?{...t,to:a(t.to)}:t);return n})(e.code)),r=e.threads.map(e=>e.name),a=e.maxStates??2e5,n={pc:t.map(()=>0),regs:t.map(()=>({})),vars:{...e.vars},locks:{},sems:{...e.sems},blocked:t.map(()=>null)},c=(e,r)=>e.pc[r]>=t[r].length,u=(e,t,r)=>"number"==typeof r?r:e.regs[t][r]??e.vars[r]??0,d=new Map,f=(e,t)=>{let r=t?[t]:[];for(let t=e,a=d.get(t);a;a=d.get(t))r.push(a[1]),t=a[0];return r.reverse()},p=l(n),h=new Set([p]),m=[[p,n]],g={states:1,truncated:!1,finals:[]},k=new Map,x=new Map,b=new Map;for(;m.length&&!g.failure;){let n=[];for(let[p,y]of m){let m=!1;for(let s=0;s<t.length&&!g.failure;s++)for(let k of function(a,n){let s=a.blocked[n];if(s){if("cv"===s.k){let t;return e.spurious?[{next:((t=i(a)).blocked[n]={k:"relock",m:s.m},t),label:`${r[n]}: wakes without a signal`}]:[]}if(void 0!==a.locks[s.m])return[];let t=i(a);return t.locks[s.m]=n,t.blocked[n]=null,t.pc[n]++,[{next:t,label:`${r[n]}: re-takes ${s.m} after cond_wait`}]}if(c(a,n))return[];let l=t[n][a.pc[n]],d=`${r[n]}: ${(e=>{switch(e.op){case"lock":return`lock(${e.m})`;case"unlock":return`unlock(${e.m})`;case"wait":return`sem_wait(${e.s})`;case"post":return`sem_post(${e.s})`;case"cwait":return`cond_wait(${e.c}, ${e.m})`;case"signal":return`cond_signal(${e.c})`;case"broadcast":return`cond_broadcast(${e.c})`;case"load":return`${e.reg} = ${e.v}`;case"add":return`${e.reg} += ${e.k}`;case"store":return`${e.v} = ${e.reg}`;case"set":return`${e.v} = ${e.to}`;case"inc":return`${e.v} += ${e.k}`;case"if":return`if (${e.a} ${e.cmp} ${e.b}) goto ${e.to}`;case"jmp":return`goto ${e.to}`;case"assert":return`assert(${e.a} ${e.cmp} ${e.b})`;case"label":return`${e.name}:`}})(l)}`,f=(e,t=!0)=>{let r=i(a);return e(r),t&&r.pc[n]++,{next:r,label:d}};switch(l.op){case"lock":return void 0===a.locks[l.m]?[f(e=>void(e.locks[l.m]=n))]:[];case"unlock":if(a.locks[l.m]!==n)return[{label:d,problem:`${r[n]} unlocks ${l.m} without holding it`}];return[f(e=>void delete e.locks[l.m])];case"wait":return(a.sems[l.s]??0)>0?[f(e=>void e.sems[l.s]--)]:[];case"post":return[f(e=>void(e.sems[l.s]=(e.sems[l.s]??0)+1))];case"cwait":if(a.locks[l.m]!==n)return[{label:d,problem:`${r[n]} calls cond_wait without holding ${l.m}`}];return[f(e=>{delete e.locks[l.m],e.blocked[n]={k:"cv",c:l.c,m:l.m}},!1)];case"signal":case"broadcast":{let e=a.blocked.flatMap((e,t)=>e&&"cv"===e.k&&e.c===l.c?[t]:[]);if(!e.length)return[f(()=>{})];let t=(e,t)=>{let r=e.blocked[t];e.blocked[t]={k:"relock",m:r.m}};if("broadcast"===l.op)return[f(r=>e.forEach(e=>t(r,e)))];return e.map(e=>({...f(r=>t(r,e)),label:`${d} (wakes ${r[e]})`}))}case"load":return[f(e=>void(e.regs[n][l.reg]=a.vars[l.v]??0))];case"add":return[f(e=>void(e.regs[n][l.reg]=(a.regs[n][l.reg]??0)+l.k))];case"store":return[f(e=>void(e.vars[l.v]=a.regs[n][l.reg]??0))];case"set":return[f(e=>void(e.vars[l.v]=u(a,n,l.to)))];case"inc":return[f(e=>void(e.vars[l.v]=(a.vars[l.v]??0)+l.k))];case"if":return[f(e=>void(e.pc[n]=o[l.cmp](u(a,n,l.a),u(a,n,l.b))?l.to:a.pc[n]+1),!1)];case"jmp":return[f(e=>void(e.pc[n]=l.to),!1)];case"assert":if(!o[l.cmp](u(a,n,l.a),u(a,n,l.b)))return[{label:d,problem:l.msg??`assertion failed: ${l.a} ${l.cmp} ${l.b} (${u(a,n,l.a)} vs ${u(a,n,l.b)})`}];return[f(()=>{})]}}(y,s)){if(k.problem){g.failure={message:k.problem,trace:f(p,k.label)};break}m=!0;let t=l(k.next);if(e.fairness&&(b.set(p,y),(x.get(p)??x.set(p,[]).get(p)).push([s,t])),!h.has(t)){if(h.size>=a){g.truncated=!0;continue}h.add(t),d.set(t,[p,k.label]),n.push([t,k.next])}}if(!g.failure&&!m){if(t.every((e,t)=>c(y,t)))k.set(s(y.vars),Object.fromEntries(Object.entries(y.vars).sort(([e],[t])=>e<t?-1:1)));else if(!g.deadlock){let e=t.flatMap((e,t)=>c(y,t)?[]:[r[t]]);g.deadlock={message:`deadlock: ${e.join(", ")} can never move`,trace:f(p)}}}}m=n}if(g.states=h.size,g.finals=[...k.values()],e.fairness&&!g.failure&&!g.truncated){let a=Array.isArray(e.fairness)?e.fairness:r,n=function(e,t,r){let a=new Map,n=new Map,o=new Set,s=[],l=0;for(let i of e.keys()){if(a.has(i))continue;let c=[[i,0]];for(a.set(i,l),n.set(i,l++),s.push(i),o.add(i);c.length;){let i=c[c.length-1],[u,d]=i,f=e.get(u)??[];if(d<f.length){i[1]++;let e=f[d][1];a.has(e)?o.has(e)&&n.set(u,Math.min(n.get(u),a.get(e))):(a.set(e,l),n.set(e,l++),s.push(e),o.add(e),c.push([e,0]));continue}if(c.pop(),c.length){let e=c[c.length-1][0];n.set(e,Math.min(n.get(e),n.get(u)))}if(n.get(u)!==a.get(u))continue;let p=new Set;for(let e="";e!==u;)e=s.pop(),o.delete(e),p.add(e);let h=[...p].flatMap(t=>(e.get(t)??[]).filter(([,e])=>p.has(e)).map(([e])=>e));if(!h.length)continue;let m=new Set(h);if(![...new Set([...p].flatMap(t=>(e.get(t)??[]).map(([e])=>e)))].some(e=>!m.has(e))){for(let e=0;e<r;e++)if(!t(u,e))return{thread:e,key:u}}}}return null}(x,(e,t)=>c(b.get(e),t)||!a.includes(r[t]),t.length);n&&(g.starvation={message:`starvation: ${r[n.thread]} never finishes under a fair schedule`,trace:f(n.key)})}return g}(t.program),program:t.program}}catch(e){return{ok:!1,error:{line:1,message:e instanceof Error?e.message:"cannot run"}}}}function h(e){if(e.failure)return{safe:!1,text:`FAILS: ${e.failure.message}`,trace:e.failure.trace};if(e.deadlock)return{safe:!1,text:`DEADLOCK: ${e.deadlock.message}`,trace:e.deadlock.trace};if(e.truncated)return{safe:!1,text:"Too many states to finish checking. Shrink the program.",trace:[]};let t=e.finals.map(e=>JSON.stringify(e)).join(" or ");return e.finals.length>1?{safe:c(e),text:`No crash or deadlock in ${e.states} states, but the result depends on the schedule: ${t}`,trace:[]}:{safe:c(e),text:`SAFE in all ${e.states} states. Final values: ${t}`,trace:[]}}let m=[{id:"lost-update",title:"Find the missing lock",goal:"Two threads each add 1 to count. Make count always end at 2.",hint:"The read-modify-write must be one critical section.",starter:`var count = 0
thread A
r = count
r += 1
count = r
thread B
r = count
r += 1
count = r`,extra:e=>[...new Set(e.finals.map(e=>e.count??0))].sort((e,t)=>e-t).every(e=>2===e),solution:`var count = 0
thread A
lock m
r = count
r += 1
count = r
unlock m
thread B
lock m
r = count
r += 1
count = r
unlock m`},{id:"mutual-exclusion",title:"Two inside at once",goal:"The assert says only one thread may be in the critical section. Make it hold in every interleaving.",hint:"Guard both the enter and the assert with the same mutex.",starter:`var inside = 0
thread A
inside += 1
assert inside == 1
inside += -1
thread B
inside += 1
assert inside == 1
inside += -1`,solution:`var inside = 0
thread A
lock m
inside += 1
assert inside == 1
inside += -1
unlock m
thread B
lock m
inside += 1
assert inside == 1
inside += -1
unlock m`},{id:"lock-order",title:"The lock-order fix",goal:"A takes a then b, B takes b then a. Remove the deadlock without removing a lock.",hint:"Give every thread the same global order for taking locks.",starter:`thread A
lock a
lock b
unlock b
unlock a
thread B
lock b
lock a
unlock a
unlock b`,solution:`thread A
lock a
lock b
unlock b
unlock a
thread B
lock a
lock b
unlock b
unlock a`},{id:"lost-wakeup",title:"The lost wakeup",goal:"The consumer sleeps on a condition variable but the producer may signal first. Make it finish in every order.",hint:"Sleep only while the condition is still false, and test it under the mutex.",starter:`var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
cwait c m
assert ready == 1
unlock m`,solution:`var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
again:
if ready == 1 goto go
cwait c m
goto again
go:
assert ready == 1
unlock m`},{id:"if-vs-while",title:"if is not while",goal:"This consumer rechecks nothing after waking, and sleepers can wake spuriously. Make the assert always true.",hint:"After cwait returns, the condition may still be false: loop back and test it again.",starter:`spurious
var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
if ready == 1 goto go
cwait c m
go:
assert ready == 1
unlock m`,solution:`spurious
var ready = 0
thread Producer
lock m
ready = 1
signal c
unlock m
thread Consumer
lock m
again:
if ready == 1 goto go
cwait c m
goto again
go:
assert ready == 1
unlock m`},{id:"sem-mutex",title:"A semaphore that is not a mutex",goal:"A semaphore guards the critical section but it starts at the wrong value. Fix it so only one thread is inside.",hint:"A binary semaphore used as a lock starts at 1.",starter:`sem gate = 2
var inside = 0
thread A
wait gate
inside += 1
assert inside == 1
inside += -1
post gate
thread B
wait gate
inside += 1
assert inside == 1
inside += -1
post gate`,solution:`sem gate = 1
var inside = 0
thread A
wait gate
inside += 1
assert inside == 1
inside += -1
post gate
thread B
wait gate
inside += 1
assert inside == 1
inside += -1
post gate`},{id:"rendezvous",title:"Meet in the middle",goal:"Each thread must wait for the other to arrive, but both wait first. Reorder so both finish.",hint:"Announce your own arrival (post) before you wait for the other.",starter:`sem a = 0
sem b = 0
thread A
wait b
post a
thread B
wait a
post b`,solution:`sem a = 0
sem b = 0
thread A
post a
wait b
thread B
post b
wait a`},{id:"early-exit",title:"The forgotten unlock",goal:"A skips its unlock on one path and B then waits forever. Make every path release the mutex.",hint:"Both exits from the critical section need an unlock.",starter:`var flag = 0
thread A
lock m
if flag == 0 goto out
unlock m
out:
flag = 1
thread B
lock m
flag += 1
unlock m`,solution:`var flag = 0
thread A
lock m
if flag == 0 goto out
unlock m
goto end
out:
flag = 1
unlock m
end:
thread B
lock m
flag += 1
unlock m`}],g="kc-conc-lab-v1",k=m[0].solution;function x({src:e}){let r=(0,a.useMemo)(()=>p(e),[e]);if(!r.ok)return(0,t.jsxs)("p",{className:"border-2 border-[#1a1430] bg-[#f0a0a0] p-2 text-[13px]","data-testid":"cl-verdict",children:["Line ",r.error.line,": ",r.error.message]});let n=h(r.report);return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("p",{className:"border-2 border-[#1a1430] p-2 text-[13px]",style:{background:n.safe?"#9fe0b0":"#f0a0a0"},"data-testid":"cl-verdict",children:n.text}),n.trace.length?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("p",{className:"font-pixel text-[8px]",children:["SHORTEST BAD SCHEDULE (",n.trace.length," STEPS)"]}),(0,t.jsx)("ol",{className:"list-decimal bg-[#1a1430] py-2 pl-8 pr-2 text-[12px] leading-5 text-[#e6efc8]","data-testid":"cl-trace",children:n.trace.map((e,r)=>(0,t.jsx)("li",{children:e},r))})]}):null]})}e.s(["ConcLab",0,function(){let[e,o]=(0,a.useState)(0),[s,l]=(0,a.useState)({}),[i,c]=(0,a.useState)([]),[u,d]=(0,a.useState)(null);(0,a.useEffect)(()=>{queueMicrotask(()=>{try{let e=JSON.parse(localStorage.getItem(g)??"[]");Array.isArray(e)&&c(e.filter(e=>"string"==typeof e))}catch{}})},[]);let f=e>=0?m[e]:null,b=f?f.id:"free",y=s[b]??(f?f.starter:k),v=e=>{o(e),d(null)};return(0,t.jsxs)("main",{className:"mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]",children:[(0,t.jsxs)("header",{className:"flex items-center justify-between gap-2",children:[(0,t.jsx)(r.default,{href:"/map",className:"flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow",children:"◀ MAP"}),(0,t.jsx)("h1",{className:"font-pixel text-sm text-[#ffe27a] pixel-shadow",children:"THREAD LAB"}),(0,t.jsx)("span",{className:"w-12"})]}),(0,t.jsxs)("div",{className:"grid grid-cols-5 gap-1",role:"tablist","aria-label":"Challenges",children:[m.map((r,a)=>(0,t.jsxs)("button",{role:"tab","aria-selected":a===e,"data-testid":`clc-${a}`,onClick:()=>v(a),className:`gb-box min-h-11 font-pixel text-[8px] ${a===e?"bg-[#ffe27a]!":""}`,children:[a+1,i.includes(r.id)?"★":""]},r.id)),(0,t.jsx)("button",{role:"tab","aria-selected":e<0,"data-testid":"clc-free",onClick:()=>v(-1),className:`gb-box min-h-11 font-pixel text-[8px] ${e<0?"bg-[#ffe27a]!":""}`,children:"FREE"})]}),(0,t.jsxs)("section",{className:"gb-box flex flex-col gap-2 p-3","aria-label":"Editor",children:[(0,t.jsx)("p",{className:"font-pixel text-[9px] leading-4",children:f?f.title.toUpperCase():"SANDBOX"}),(0,t.jsx)("p",{className:"text-[14px]",children:f?f.goal:"Write any program (up to 3 threads). The explorer tries every interleaving."}),(0,t.jsx)("textarea",{"data-testid":"cl-src","aria-label":"Program",spellCheck:!1,autoCapitalize:"off",autoCorrect:"off",value:y,onChange:e=>{l({...s,[b]:e.target.value}),d(null)},rows:Math.min(22,y.split("\n").length+1),className:"w-full resize-y bg-[#1a1430] p-2 font-mono text-[16px] leading-5 text-[#e6efc8]"}),(0,t.jsxs)("div",{className:"flex gap-2",children:[f?(0,t.jsx)("button",{"data-testid":"cl-check",onClick:()=>{if(!f)return;let e=function(e,t){let r=p(t);if(!r.ok)return{passed:!1,message:`line ${r.error.line}: ${r.error.message}`};let a=h(r.report);return a.safe?e.extra&&!e.extra(r.report)?{passed:!1,message:`Safe, but not the goal: ${a.text}`}:{passed:!0,message:a.text}:{passed:!1,message:a.text}}(f,y);if(d(e),e.passed&&!i.includes(f.id)){let e=[...i,f.id];c(e);try{localStorage.setItem(g,JSON.stringify(e))}catch{}}n.f.click()},className:"gb-box min-h-11 flex-1 font-pixel text-[9px]",children:"CHECK"}):null,(0,t.jsx)("button",{"data-testid":"cl-reset",onClick:()=>{let e={...s};delete e[b],l(e),d(null)},className:"gb-box min-h-11 flex-1 font-pixel text-[9px]",children:"RESET"})]}),u?(0,t.jsx)("p",{className:`font-pixel text-[9px] leading-4 ${u.passed?"text-[#2f7a2a]":"text-[#a02040]"}`,"data-testid":"cl-result",children:u.passed?"CLEARED ★":"NOT YET."}):null,f?(0,t.jsxs)("p",{className:"text-[12px] text-[#4a3f6a]",children:["Hint: ",f.hint]}):null,(0,t.jsx)(x,{src:y})]}),(0,t.jsxs)("details",{className:"gb-box p-3 text-[12px]",children:[(0,t.jsx)("summary",{className:"min-h-11 cursor-pointer font-pixel text-[9px] leading-[44px]",children:"LANGUAGE"}),(0,t.jsx)("pre",{className:"overflow-x-auto leading-4",children:`var n = 0        shared integer
sem s = 1       semaphore
spurious        sleepers may wake alone
thread A        start a thread
lock m / unlock m
wait s / post s
cwait c m / signal c / broadcast c
r = x           load   (r, r1, r2...)
x = r           store
x = 5 / x += 1 / r += 1
if a == b goto L / goto L
assert a == b
L:              label`})]})]})}],25876)},50395,e=>{let t=null,r=null,a=null,n=null;function o(){if(!t){let e=window.AudioContext||window.webkitAudioContext;if(!e)return null;(r=(t=new e).createGain()).gain.value=.6,r.connect(t.destination),(a=t.createGain()).gain.value=.22,a.connect(r);let o=(n=t.createBuffer(1,t.sampleRate,t.sampleRate)).getChannelData(0);for(let e=0;e<o.length;e++)o[e]=2*Math.random()-1}return"suspended"===t.state&&t.resume(),t}function s(e,t,a={}){let n=o();if(!n||!r)return;let l=n.currentTime+(a.delay??0),i=n.createOscillator(),c=n.createGain();i.type=a.type??"sine",i.frequency.setValueAtTime(e,l),a.slide&&i.frequency.exponentialRampToValueAtTime(Math.max(20,e*a.slide),l+t),c.gain.setValueAtTime(1e-4,l),c.gain.exponentialRampToValueAtTime(a.gain??.2,l+.01),c.gain.exponentialRampToValueAtTime(1e-4,l+t),i.connect(c).connect(a.dest??r),i.start(l),i.stop(l+t+.05)}function l(e,t={}){let a=o();if(!a||!r||!n)return;let s=a.currentTime+(t.delay??0),i=a.createBufferSource();i.buffer=n;let c=a.createBiquadFilter();c.type="bandpass",c.frequency.setValueAtTime(t.freq??1200,s),t.sweep&&c.frequency.exponentialRampToValueAtTime(t.sweep,s+e),c.Q.value=t.q??.8;let u=a.createGain();u.gain.setValueAtTime(t.gain??.3,s),u.gain.exponentialRampToValueAtTime(1e-4,s+e),i.connect(c).connect(u).connect(r),i.start(s),i.stop(s+e+.05)}e.s(["f",0,{unlock(){o()},click(){s(880,.06,{type:"square",gain:.05})},blip(){s(1200,.02,{type:"square",gain:.018})},levelUp(){[659,784,988,1319].forEach((e,t)=>s(e,.18,{type:"square",gain:.06,delay:.08*t}))},hover(){s(1400,.03,{type:"sine",gain:.025})},card(){s(660,.08,{type:"triangle",gain:.08,slide:1.5})},charge(){s(180,.6,{type:"sawtooth",gain:.05,slide:4}),l(.6,{gain:.05,freq:400,sweep:3e3})},cast(e){let t={process:880,scheduler:660,sync:520,memory:330,storage:147,io:990}[e];s(t,.35,{type:"sawtooth",gain:.09,slide:.5}),s(1.5*t,.3,{type:"square",gain:.04,slide:.6,delay:.03}),l(.25,{gain:.12,freq:2500,sweep:500})},hit(e=!1){s(e?70:90,.35,{type:"sine",gain:.5,slide:.4}),l(.22,{gain:e?.5:.32,freq:900,sweep:150}),e&&s(1760,.3,{type:"triangle",gain:.08,slide:.5,delay:.02})},hurt(){s(160,.3,{type:"square",gain:.12,slide:.35}),l(.2,{gain:.25,freq:600,sweep:120})},miss(){s(330,.25,{type:"triangle",gain:.1,slide:.5}),s(247,.3,{type:"triangle",gain:.08,slide:.5,delay:.1})},error(){s(200,.12,{type:"square",gain:.08}),s(150,.2,{type:"square",gain:.08,delay:.12})},victory(){[523,659,784,1047].forEach((e,t)=>s(e,.4,{type:"triangle",gain:.12,delay:.12*t})),s(1047,1.2,{type:"sine",gain:.08,delay:.5})},defeat(){[392,330,262,196].forEach((e,t)=>s(e,.5,{type:"sawtooth",gain:.06,delay:.2*t}))},unlockDex(){s(1318,.15,{type:"sine",gain:.08}),s(1760,.3,{type:"sine",gain:.08,delay:.1})}}])},22016,(e,t,r)=>{e.i(47167),Object.defineProperty(r,"__esModule",{value:!0});var a={default:function(){return k},useLinkStatus:function(){return b}};for(var n in a)Object.defineProperty(r,n,{enumerable:!0,get:a[n]});let o=e.r(90809),s=e.r(43476),l=o._(e.r(71645)),i=e.r(95057),c=e.r(8372),u=e.r(18581),d=e.r(18967),f=e.r(5550),p=e.r(88540),h=e.r(91949),m=e.r(73668),g=e.r(9396);function k(t){var r;let a,n,o,[k,b]=(0,l.useOptimistic)(h.IDLE_LINK_STATUS),y=(0,l.useRef)(null),{href:v,as:w,children:$,prefetch:A=null,passHref:j,replace:E,shallow:S,scroll:T,onClick:N,onMouseEnter:C,onTouchStart:M,legacyBehavior:P=!1,onNavigate:O,transitionTypes:L,ref:_,unstable_dynamicOnHover:B,...R}=t;a=$,P&&("string"==typeof a||"number"==typeof a)&&(a=(0,s.jsx)("a",{children:a}));let U=l.default.useContext(c.AppRouterContext),q=!1!==A,F=!1===A?"none":!0===A?"full":"auto",I="none"!==F?"auto"===F?g.FetchStrategy.PPR:g.FetchStrategy.Full:g.FetchStrategy.PPR,D="string"==typeof(r=w||v)?r:(0,i.formatUrl)(r);if(P){if(a?.$$typeof===Symbol.for("react.lazy"))throw Error("`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag.");n=l.default.Children.only(a)}let z=P?n&&"object"==typeof n&&n.ref:_,K,V=l.default.useCallback(e=>(null!==U&&(y.current=(0,h.mountLinkInstance)(e,D,U,I,q,b,K)),()=>{y.current&&((0,h.unmountLinkForCurrentNavigation)(y.current),y.current=null),(0,h.unmountPrefetchableInstance)(e)}),[q,D,U,I,b,K]),G={ref:(0,u.useMergedRef)(V,z),onClick(t){P||"function"!=typeof N||N(t),P&&n.props&&"function"==typeof n.props.onClick&&n.props.onClick(t),!U||t.defaultPrevented||function(t,r,a,n,o,s,l,i="none"){if("u">typeof window){let c,{nodeName:u}=t.currentTarget;if("A"===u.toUpperCase()&&((c=t.currentTarget.getAttribute("target"))&&"_self"!==c||t.metaKey||t.ctrlKey||t.shiftKey||t.altKey||t.nativeEvent&&2===t.nativeEvent.which)||t.currentTarget.hasAttribute("download"))return;if(!(0,m.isLocalURL)(r)){n&&(t.preventDefault(),location.replace(r));return}if(t.preventDefault(),s){let e=!1;if(s({preventDefault:()=>{e=!0}}),e)return}let{navigate:d}=e.r(32916);d(r,n?"replace":"push",!1===o?p.ScrollBehavior.NoScroll:p.ScrollBehavior.Default,a.current,l,i)}}(t,D,y,E,T,O,L,F)},onMouseEnter(e){P||"function"!=typeof C||C(e),P&&n.props&&"function"==typeof n.props.onMouseEnter&&n.props.onMouseEnter(e),U&&q&&(0,h.onNavigationIntent)(e.currentTarget,!0===B)},onTouchStart:function(e){P||"function"!=typeof M||M(e),P&&n.props&&"function"==typeof n.props.onTouchStart&&n.props.onTouchStart(e),U&&q&&(0,h.onNavigationIntent)(e.currentTarget,!0===B)}};return(0,d.isAbsoluteUrl)(D)?G.href=D:P&&!j&&("a"!==n.type||"href"in n.props)||(G.href=(0,f.addBasePath)(D)),o=P?l.default.cloneElement(n,G):(0,s.jsx)("a",{...R,...G,children:a}),(0,s.jsx)(x.Provider,{value:k,children:o})}let x=(0,l.createContext)(h.IDLE_LINK_STATUS),b=()=>(0,l.useContext)(x);("function"==typeof r.default||"object"==typeof r.default&&null!==r.default)&&void 0===r.default.__esModule&&(Object.defineProperty(r.default,"__esModule",{value:!0}),Object.assign(r.default,r),t.exports=r.default)},18581,(e,t,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"useMergedRef",{enumerable:!0,get:function(){return n}});let a=e.r(71645);function n(e,t){let r=(0,a.useRef)(null),n=(0,a.useRef)(null);return(0,a.useCallback)(a=>{if(null===a){let e=r.current;e&&(r.current=null,e());let t=n.current;t&&(n.current=null,t())}else e&&(r.current=o(e,a)),t&&(n.current=o(t,a))},[e,t])}function o(e,t){if("function"!=typeof e)return e.current=t,()=>{e.current=null};{let r=e(t);return"function"==typeof r?r:()=>e(null)}}("function"==typeof r.default||"object"==typeof r.default&&null!==r.default)&&void 0===r.default.__esModule&&(Object.defineProperty(r.default,"__esModule",{value:!0}),Object.assign(r.default,r),t.exports=r.default)},95057,(e,t,r)=>{e.i(47167),Object.defineProperty(r,"__esModule",{value:!0});var a={formatUrl:function(){return l},formatWithValidation:function(){return c},urlObjectKeys:function(){return i}};for(var n in a)Object.defineProperty(r,n,{enumerable:!0,get:a[n]});let o=e.r(90809)._(e.r(98183)),s=/https?|ftp|gopher|file/;function l(e){let{auth:t,hostname:r}=e,a=e.protocol||"",n=e.pathname||"",l=e.hash||"",i=e.query||"",c=!1;t=t?encodeURIComponent(t).replace(/%3A/i,":")+"@":"",e.host?c=t+e.host:r&&(c=t+(~r.indexOf(":")?`[${r}]`:r),e.port&&(c+=":"+e.port)),i&&"object"==typeof i&&(i=String(o.urlQueryToSearchParams(i)));let u=e.search||i&&`?${i}`||"";return a&&!a.endsWith(":")&&(a+=":"),e.slashes||(!a||s.test(a))&&!1!==c?(c="//"+(c||""),n&&"/"!==n[0]&&(n="/"+n)):c||(c=""),l&&"#"!==l[0]&&(l="#"+l),u&&"?"!==u[0]&&(u="?"+u),n=n.replace(/[?#]/g,encodeURIComponent),u=u.replace("#","%23"),`${a}${c}${n}${u}${l}`}let i=["auth","hash","host","hostname","href","path","pathname","port","protocol","query","search","slashes"];function c(e){return l(e)}},73668,(e,t,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"isLocalURL",{enumerable:!0,get:function(){return o}});let a=e.r(18967),n=e.r(52817);function o(e){if(!(0,a.isAbsoluteUrl)(e))return!0;try{let t=(0,a.getLocationOrigin)(),r=new URL(e,t);return r.origin===t&&(0,n.hasBasePath)(r.pathname)}catch(e){return!1}}},18967,(e,t,r)=>{e.i(47167),Object.defineProperty(r,"__esModule",{value:!0});var a={DecodeError:function(){return k},MiddlewareNotFoundError:function(){return v},MissingStaticPage:function(){return y},NormalizeError:function(){return x},PageNotFoundError:function(){return b},SP:function(){return m},ST:function(){return g},WEB_VITALS:function(){return o},execOnce:function(){return s},getDisplayName:function(){return d},getLocationOrigin:function(){return c},getURL:function(){return u},isAbsoluteUrl:function(){return i},isResSent:function(){return f},loadGetInitialProps:function(){return h},normalizeRepeatedSlashes:function(){return p},stringifyError:function(){return w}};for(var n in a)Object.defineProperty(r,n,{enumerable:!0,get:a[n]});let o=["CLS","FCP","INP","LCP","TTFB"];function s(e){let t,r=!1;return(...a)=>(r||(r=!0,t=e(...a)),t)}let l=/^[a-zA-Z][a-zA-Z\d+\-.]*?:/,i=e=>{let t=e.charCodeAt(0);return!!(t>=65&&t<=90||t>=97&&t<=122)&&l.test(e)};function c(){let{protocol:e,hostname:t,port:r}=window.location;return`${e}//${t}${r?":"+r:""}`}function u(){let{href:e}=window.location,t=c();return e.substring(t.length)}function d(e){return"string"==typeof e?e:e.displayName||e.name||"Unknown"}function f(e){return e.finished||e.headersSent}function p(e){let t=e.split("?");return t[0].replace(/\\/g,"/").replace(/\/\/+/g,"/")+(t[1]?`?${t.slice(1).join("?")}`:"")}async function h(e,t){let r=t.res||t.ctx&&t.ctx.res;if(!e.getInitialProps)return t.ctx&&t.Component?{pageProps:await h(t.Component,t.ctx)}:{};let a=await e.getInitialProps(t);if(r&&f(r))return a;if(!a)throw Error(`"${d(e)}.getInitialProps()" should resolve to an object. But found "${a}" instead.`);return a}let m="u">typeof performance,g=m&&["mark","measure","getEntriesByName"].every(e=>"function"==typeof performance[e]);class k extends Error{}class x extends Error{}class b extends Error{constructor(e){super(),this.code="ENOENT",this.name="PageNotFoundError",this.message=`Cannot find module for page: ${e}`}}class y extends Error{constructor(e,t){super(),this.message=`Failed to load static file for page: ${e} ${t}`}}class v extends Error{constructor(){super(),this.code="ENOENT",this.message="Cannot find the middleware module"}}function w(e){return JSON.stringify({message:e.message,stack:e.stack})}}])})();