// DevTools connection to the user-authorized Android test emulator only.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export async function connectAndroid() {
 const tabs=await (await fetch('http://127.0.0.1:9223/json')).json();
 const tab=tabs.find(t=>t.url.startsWith('http://127.0.0.1:876'));
 if(!tab)throw Error('No local USER_HOUSE emulator test page');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map();ws.onmessage=e=>{const msg=JSON.parse(e.data);if(pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(JSON.stringify(msg.error))):resolve(msg.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 return {send,close:()=>ws.close(),evaluate:async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href && process.argv[2]){const c=await connectAndroid();try{console.log(JSON.stringify(await c.evaluate(readFileSync(process.argv[2],'utf8')),null,2));}finally{c.close();}}
