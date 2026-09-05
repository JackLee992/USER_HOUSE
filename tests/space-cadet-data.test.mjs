import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCadetData} from '../src/games/space-cadet-data.js';

const cstring = value => Buffer.from(`${value}\0`);
const shorts = values => { const b = Buffer.alloc(values.length * 2); values.forEach((n,i) => b.writeInt16LE(n,i*2)); return b; };
const floats = values => { const b = Buffer.alloc(values.length * 4); values.forEach((n,i) => b.writeFloatLE(n,i*4)); return b; };
function bitmap({width=4,height=2,resolution=0,flags=0,payload}={}) {
  payload ||= Buffer.alloc(Math.ceil(width/4)*4*height);
  const h = Buffer.alloc(14); h[0]=resolution; h.writeInt16LE(width,1); h.writeInt16LE(height,3); h.writeInt32LE(payload.length,9); h[13]=flags;
  return Buffer.concat([h,payload]);
}
function depth({width=4,height=2,stride=width,fullTilt=false,resolution=0,placeholder=false}={}) {
  const h=Buffer.alloc(14+(fullTilt?1:0)), o=fullTilt?1:0;
  if(fullTilt) h[0]=resolution;
  if(!placeholder) { h.writeInt16LE(width,o); h.writeInt16LE(height,o+2); h.writeInt16LE(stride,o+4); }
  return Buffer.concat([h,Buffer.alloc(stride*height*2)]);
}
function container(groups) {
  const header=Buffer.alloc(183); header.write('PARTOUT(4.0)RESOURCE'); header.writeUInt16LE(groups.length,175);
  const body=Buffer.concat(groups.map(fields => Buffer.concat([Buffer.from([fields.length]),...fields.map(([kind,bytes]) => {
    const h=Buffer.alloc(kind===0||kind===2?1:5); h[0]=kind; if(h.length===5) h.writeInt32LE(bytes.length,1); return Buffer.concat([h,bytes]);
  })])));
  header.writeUInt32LE(header.length+body.length,171);header.writeUInt32LE(body.length,177);
  return Buffer.concat([header,body]);
}
function tableGroups(fullTilt=false) {
  return [
    [[1,bitmap()],[3,cstring('background')],[5,Buffer.alloc(1024)]],
    [[0,shorts([200])],[1,bitmap()],[3,cstring('table')],[11,floats([700,2,1])],[12,depth({fullTilt})]],
    [[3,cstring('camera_info')],[11,floats(Array(15).fill(1))]],
    [[3,cstring('table_objects')],[10,shorts([1025,1000,1])]],
  ];
}
const rejected = (groups, filename) => assert.throws(() => validateCadetData(container(groups),filename),/DAT/);

test('accepts raw, unaligned and DIB bitmap layouts and bounded typed records', () => {
  for (const flags of [0,1,2]) {
    const groups=tableGroups();groups.push([[1,bitmap({width:3,flags})]]);
    assert.equal(validateCadetData(container(groups),'PINBALL.DAT') instanceof Buffer,true);
  }
});
test('accepts Full Tilt depth-map prefixes, all sprite resolutions and original unused zero maps', () => {
  for (const fullTilt of [false,true]) {
    const groups=tableGroups(fullTilt);groups.push([[12,depth({fullTilt,placeholder:true})]]);
    if(fullTilt) for(const resolution of [1,2]) groups.push([[1,bitmap({resolution})],[12,depth({fullTilt,resolution})]]);
    const bytes=container(groups);
    assert.doesNotThrow(() => validateCadetData(bytes,fullTilt?'CADET.DAT':'PINBALL.DAT'));
    assert.doesNotThrow(() => validateCadetData(bytes));
    assert.throws(() => validateCadetData(bytes,fullTilt?'PINBALL.DAT':'CADET.DAT'));
  }
});
test('validates spliced run bounds without requiring raw-bitmap length or resolution zero', () => {
  for(const [resolution,tableWidth] of [600,752,960].entries()) {
    // One pixel, then skip to the next row using the upstream table-width rule.
    const payload=Buffer.from([0,0,1,0,0,0,10,(tableWidth-1)&255,(tableWidth-1)>>8,1,0,0,0,11,255,255]);
    const groups=tableGroups();groups.push([[1,bitmap({resolution,flags:4,payload})]]);
    assert.doesNotThrow(() => validateCadetData(container(groups)));
    for(const badPayload of [payload.subarray(0,-2),Buffer.from([0,0,255,255]),Buffer.from([1,0,0,0])]) {
      const bad=tableGroups();bad.push([[1,bitmap({resolution,flags:4,payload:badPayload})]]);rejected(bad);
    }
  }
});
test('rejects malformed bitmap headers, allocations and depth maps before invoking native code', () => {
  for(const mutate of [b=>b[0]=255,b=>b.writeInt16LE(-1,1),b=>b.writeInt32LE(0,9),b=>b.writeInt32LE(9999999,9)]) {
    const groups=tableGroups();mutate(groups[0][0][1]);rejected(groups);
  }
  for(const map of [Buffer.alloc(2),depth({stride:3}),depth({width:0}),depth().subarray(0,-2)]) {
    const groups=tableGroups();groups[1][4][1]=map;rejected(groups);
  }
  const groups=tableGroups(), huge=bitmap({flags:4,payload:Buffer.from([255,255])});huge.writeInt16LE(32767,1);huge.writeInt16LE(32767,3);groups.push([[1,huge]]);rejected(groups);
});
test('rejects missing table structures, invalid references, strings and numeric arrays', () => {
  rejected(['table','table_objects','background'].map(name=>[[3,cstring(name)]]));
  for(const [g,e,bytes] of [[0,2,Buffer.alloc(1000)],[2,0,Buffer.from('camera_info')],[2,1,floats([NaN])],[3,1,shorts([1025,1000,300])],[3,1,Buffer.alloc(3)]]) {
    const groups=tableGroups();groups[g][e][1]=bytes;rejected(groups);
  }
  const signedCount=container(tableGroups());signedCount[183]=255;assert.throws(()=>validateCadetData(signedCount));
  assert.throws(()=>validateCadetData(container(tableGroups()).subarray(0,-1)));
});
test('validates the shipped CC0 DAT and rejects mutations of its real bitmap header', () => {
  // The reproducible asset package starts with the unmodified CC0 PINBALL.DAT.
  const packed=readFileSync(new URL('../assets/space-cadet/space-cadet.data',import.meta.url));
  const bytes=packed.subarray(0,packed.readUInt32LE(171));
  assert.equal(bytes.subarray(0,20).toString(),'PARTOUT(4.0)RESOURCE');
  assert.doesNotThrow(()=>validateCadetData(bytes,'PINBALL.DAT'));
  let p=183+bytes.readUInt16LE(181), bitmapOffset;
  for(let g=0;g<bytes.readUInt16LE(175);g++) {
    const entries=bytes[p++];
    for(let e=0;e<entries;e++) {
      const kind=bytes[p++];let size=2;if(kind!==0&&kind!==2){size=bytes.readInt32LE(p);p+=4;}
      if(kind===1&&bitmapOffset===undefined) bitmapOffset=p;p+=size;
    }
  }
  assert.notEqual(bitmapOffset,undefined);
  for(const mutate of [b=>b[bitmapOffset]=255,b=>b.writeInt16LE(-1,bitmapOffset+1),b=>b.writeInt32LE(0,bitmapOffset+9)]) {
    const bad=Buffer.from(bytes);mutate(bad);assert.throws(()=>validateCadetData(bad,'PINBALL.DAT'));
  }
});
