import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('  function extensionUpdateHeaders()'), source.indexOf('  function companionDockSide(')).replaceAll('import.meta.url', '__moduleUrl');
const version = (extra = {}) => ({currentBranchName:'main',currentCommitHash:'a'.repeat(40),isUpToDate:true,remoteUrl:'https://github.com/JackLee992/USER_HOUSE.git',...extra});
function harness(respond, url = 'http://localhost/scripts/extensions/third-party/USER_HOUSE/src/runtime/wanban-app.js') {
  const requests = [], saved = [], messages = [];
  const context = vm.createContext({URL,console,AbortController,setTimeout,clearTimeout,EXTENSION_VERSION:'3.8.0',
    EXTENSION_UPDATE_FALLBACKS:['/USER_HOUSE','/wanban-xiaowu'],
    EXTENSION_UPDATE_REPOSITORY:'https://github.com/JackLee992/USER_HOUSE',EXTENSION_UPDATE_BRANCH:'main',
    __moduleUrl:url,getRequestHeaders:() => ({'Content-Type':'application/json','X-CSRF-Token':'test'}),
    updateState:{checking:false,updating:false,checked:false,available:false,updated:false,error:'',data:null},
    qs:() => null,qsa:() => [],toast:text => messages.push(text),esc:String,
    activeGameController:{save:() => saved.push('game')},flushAllProgressSaves:() => saved.push('progress'),flushSettingsProgress:() => saved.push('settings'),
    fetch:async (path, options = {}) => {
      const request = {path,...options,body:options.body ? JSON.parse(options.body) : null}; requests.push(request);
      const reply = await respond(request, requests);
      return {ok:(reply.status || 200) < 400,status:reply.status || 200,json:async () => reply.data,text:async () => reply.text || ''};
    },
  });
  vm.runInContext(body, context);
  return {context,requests,saved,messages,run:code => vm.runInContext(code,context)};
}

test('renamed global installation uses its own discovered directory and scope', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[{name:'third-party/my-house',type:'global'}]} : {data:version()}, 'http://localhost/scripts/extensions/third-party/my-house/src/runtime/wanban-app.js');
  await h.run('checkExtensionUpdate(true)');
  assert.equal(h.requests[1].body.extensionName,'my-house');
  assert.equal(h.requests[1].body.global,true);
  assert.equal(h.context.updateState.checked,true);
  assert.equal(h.context.updateState.available,false);
});
test('legacy branch is checked without mutation, then native switch and pull are verified', async () => {
  let reads = 0;
  const h = harness(req => {
    if (req.path.endsWith('/discover')) return {data:[{name:'third-party/USER_HOUSE',type:'local'}]};
    if (req.path.endsWith('/manifest.json')) return {data:{version:'3.9.0'}};
    if (req.path.endsWith('/version')) return {data:++reads < 3 ? version({currentBranchName:'feature/classic-games-via'}) : version({currentCommitHash:'b'.repeat(40)})};
    if (req.path.endsWith('/branches')) return {data:[{name:'origin/main'}]};
    if (req.path.endsWith('/switch')) return {status:204};
    if (req.path.endsWith('/update')) return {data:{isUpToDate:false,shortCommitHash:'bbbbbbb'}};
    throw Error(req.path);
  });
  await h.run('checkExtensionUpdate(false)');
  assert.equal(h.context.updateState.available,true);
  assert.equal(h.requests.some(r => r.path.endsWith('/switch')),false);
  await h.run('runExtensionUpdate()');
  assert.deepEqual(h.requests.filter(r => r.path.startsWith('/api/extensions/')).map(r => r.path.split('/').pop()),['discover','version','discover','version','branches','switch','update','version']);
  assert.equal(h.requests.find(r => r.path.endsWith('/switch')).body.branch,'origin/main');
  assert.equal(h.context.updateState.updated,true);
  assert.equal(h.context.updateState.data.currentBranchName,'main');
  assert.deepEqual(h.saved,['game','progress','settings']);
});
test('a foreign origin is not updated and is never reported as latest', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[]} : {data:version({remoteUrl:'https://github.com/gloria-yin/USER_HOUSE'})});
  await h.run('runExtensionUpdate()');
  assert.match(h.context.updateState.error,/当前安装来源/);
  assert.equal(h.requests.some(r => r.path.endsWith('/update')),false);
});
test('a non-git copy is not reported as latest', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[]} : {data:version({currentCommitHash:'',currentBranchName:'',remoteUrl:''})});
  await h.run('checkExtensionUpdate(true)');
  assert.match(h.context.updateState.error,/Git/);
  assert.equal(h.context.updateState.available,false);
});
test('successful update HTTP response does not imply the pull finished', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[]} : req.path.endsWith('/update') ? {data:{isUpToDate:false}} : {data:version({isUpToDate:false})});
  await h.run('runExtensionUpdate()');
  assert.equal(h.context.updateState.updated,false);
  assert.match(h.context.updateState.error,/更新后校验未通过/);
});
test('native update failure retains saves and does not invoke install or delete', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[]} : req.path.endsWith('/update') ? {status:500,text:'local changes would be overwritten'} : {data:version()});
  await h.run('runExtensionUpdate()');
  assert.match(h.context.updateState.error,/local changes/);
  assert.deepEqual(h.saved,['game','progress','settings']);
  assert.equal(h.requests.some(r => /\/(install|delete)$/.test(r.path)),false);
});
test('an already-current main checkout needs no refresh and is verified after update', async () => {
  const h = harness(req => req.path.endsWith('/discover') ? {data:[]} : {data:version()});
  await h.run('runExtensionUpdate()');
  assert.equal(h.context.updateState.error,'');
  assert.equal(h.context.updateState.updated,false);
  assert.equal(h.requests.filter(r => r.path.endsWith('/version')).length,2);
});
