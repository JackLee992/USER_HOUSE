// Run only against an explicitly prepared disposable extension clone.
// Uses the official SillyTavern router body and real Git, not fake API replies.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const [sillyRoot, dependencyRoot, fixtureRoot, output] = process.argv.slice(2);
if (!output || !fixtureRoot.includes('native-update-fixture')) throw Error('Usage: native-extension-update.mjs SILLY_ROOT DEPS_ROOT disposable-native-update-fixture OUTPUT_JSON');
const require = createRequire(path.resolve(dependencyRoot,'package.json'));
const express = require('express'), sanitize = require('sanitize-filename'), git = require('simple-git');
const officialPath = path.resolve(sillyRoot,'src/endpoints/extensions.js');
const official = fs.readFileSync(officialPath,'utf8');
// Substitute server bootstrap dependencies only. Endpoint bodies stay unchanged.
const routerBody = official.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const globals = path.resolve(fixtureRoot,'global'), builtins = path.resolve(fixtureRoot,'system');
fs.mkdirSync(globals,{recursive:true}); fs.mkdirSync(builtins,{recursive:true});
const createRouter = new Function('path','fs','express','sanitize','CheckRepoActions','simpleGit','PUBLIC_DIRECTORIES','getConfigValue','isValidUrl','createGitClient',routerBody+'\nreturn router;');
const router = createRouter(path,fs,express,sanitize,git.CheckRepoActions,git.default || git,{globalExtensions:globals,extensions:builtins},(_key,fallback) => fallback,url => {try{return !!new URL(url);}catch{return false;}},() => {throw Error('Install is not permitted in this verification');});
const app = express(); app.use(express.json());
app.use((req,_res,next) => { req.user = {profile:{admin:true,handle:'isolated-update-verification'},directories:{extensions:path.resolve(fixtureRoot)}}; next(); });
app.use('/api/extensions',router);
const server = app.listen(0,'127.0.0.1');
await new Promise(resolve => server.once('listening',resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const extension = path.join(fixtureRoot,'USER_HOUSE');
const gitRead = (...args) => execFileSync('git',['-C',extension,...args],{encoding:'utf8'}).trim();
const before = {branch:gitRead('branch','--show-current'),commit:gitRead('rev-parse','HEAD'),remote:gitRead('remote','get-url','origin')};
const runtime = fs.readFileSync(new URL('../../src/runtime/wanban-app.js',import.meta.url),'utf8');
const updater = runtime.slice(runtime.indexOf('  function extensionUpdateHeaders()'),runtime.indexOf('  function companionDockSide(')).replaceAll('import.meta.url','__moduleUrl');
const requests = [], messages = [], saves = [];
const context = vm.createContext({URL,console,EXTENSION_VERSION:'3.8.0',EXTENSION_UPDATE_FALLBACKS:['/USER_HOUSE'],
  EXTENSION_UPDATE_REPOSITORY:'https://github.com/JackLee992/USER_HOUSE',EXTENSION_UPDATE_BRANCH:'main',
  __moduleUrl:address+'/scripts/extensions/third-party/USER_HOUSE/src/runtime/wanban-app.js',
  updateState:{checking:false,updating:false,checked:false,available:false,updated:false,error:'',data:null},
  getRequestHeaders:() => ({'Content-Type':'application/json'}),qs:() => null,qsa:() => [],esc:String,toast:message => messages.push(message),
  activeGameController:{save:() => saves.push('game')},flushAllProgressSaves:() => saves.push('progress'),flushSettingsProgress:() => saves.push('settings'),
  fetch:async (url,options) => {requests.push({url,body:options?.body ? JSON.parse(options.body) : null}); return fetch(new URL(url,address),options);},
});
try {
  vm.runInContext(updater,context);
  await vm.runInContext('runExtensionUpdate()',context);
  const after = {branch:gitRead('branch','--show-current'),commit:gitRead('rev-parse','HEAD'),remoteMain:gitRead('rev-parse','origin/main'),manifestVersion:JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8')).version};
  const result = {officialSillyTavernCommit:execFileSync('git',['-C',sillyRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),before,after,requests,messages,saves,state:context.updateState};
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true}); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert.equal(context.updateState.error,'');
  assert.equal(after.branch,'main'); assert.equal(after.commit,after.remoteMain);
  assert.equal(context.updateState.data.currentCommitHash,after.commit);
  assert.equal(requests.some(r => /\/(delete|install)$/.test(r.url)),false);
  assert.deepEqual(saves,['game','progress','settings']);
} finally { await new Promise(resolve => server.close(resolve)); }
