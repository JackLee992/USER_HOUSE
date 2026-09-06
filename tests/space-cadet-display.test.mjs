import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFrameLayer,displayResolution} from '../assets/space-cadet/display.js';

test('native ARGB words become opaque RGBA ImageData bytes without swapping red and blue',()=>{
  const heap=new Uint32Array([0xffff0000,0xff00ff00,0xff0000ff,0x00123456,0x7fabcdef,0xff000000]);
  const output=new Uint32Array(6);
  assert.equal(nativeFrameLayer(heap,[0,6,0,6,6,1],output,false),6);
  assert.deepEqual([...new Uint8Array(output.buffer)],[
    255,0,0,255, 0,255,0,255, 0,0,255,255,
    0x12,0x34,0x56,255, 0xab,0xcd,0xef,255, 0,0,0,255,
  ]);
});

test('HD masking compares RGB while classic mode preserves every native pixel',()=>{
  const heap=new Uint32Array([0xff112233,0x00445566,0xff000000,0x00112233,0xff445566,0xff000001]);
  const frame=[0,3,12,3,3,1],output=new Uint32Array(3);
  assert.equal(nativeFrameLayer(heap,frame,output,true),1);
  assert.deepEqual([...output],[0,0,0xff000000]);
  assert.equal(nativeFrameLayer(heap,frame,output,false),3);
  assert.deepEqual([...new Uint8Array(output.buffer)],[0x11,0x22,0x33,255,0x44,0x55,0x66,255,0,0,0,255]);
});

test('byte pointers and independent padded pixel strides address the correct rows',()=>{
  const heap=new Uint32Array(23).fill(0xdeadbeef);
  heap.set([0xff112233,0xffaabbcc],2);
  heap.set([0xff123456,0xff010203],6);
  heap.set([0xff112233,0xff000000],14);
  heap.set([0xff000000,0xff010203],21);
  const before=heap.slice(),storage=new Uint32Array(6).fill(0xcafebabe),output=storage.subarray(1,5);
  // The last background row ends exactly at the end of the heap, without padding.
  assert.equal(nativeFrameLayer(heap,[8,4,56,7,2,2],output,true),2);
  assert.deepEqual([...output],[0,0xffccbbaa,0xff563412,0]);
  assert.equal(storage[0],0xcafebabe);assert.equal(storage[5],0xcafebabe);
  assert.deepEqual(heap,before);
});

test('reusing the frame buffer clears pixels when a moving object uncovers the table',()=>{
  const heap=new Uint32Array([0xffeeeeee,0xff123456,0xff123456,0xff123456]);
  const output=new Uint32Array(2),frame=[0,2,8,2,2,1];
  assert.equal(nativeFrameLayer(heap,frame,output,true),1);
  assert.deepEqual([...output],[0xffeeeeee,0]);
  heap[0]=heap[2];heap[1]=0xffabcdef;
  assert.equal(nativeFrameLayer(heap,frame,output,true),1);
  assert.deepEqual([...output],[0,0xffefcdab]);
  heap[1]=heap[3];assert.equal(nativeFrameLayer(heap,frame,output,true),0);
  assert.deepEqual([...output],[0,0]);
});

test('nudge offsets do not alter or crop native layer pixels before composition',()=>{
  const heap=new Uint32Array([0xffff0000,0xff0000ff,0xff000000,0xff000000]);
  const unshifted=new Uint32Array(2),nudged=new Uint32Array(2);
  nativeFrameLayer(heap,[0,2,8,2,2,1,0,0],unshifted,true);
  nativeFrameLayer(heap,[0,2,8,2,2,1,-3,5],nudged,true);
  assert.deepEqual(nudged,unshifted);
});

test('empty layer dimensions neither count nor overwrite output pixels',()=>{
  const output=new Uint32Array([0xdeadbeef]);
  assert.equal(nativeFrameLayer(new Uint32Array(),[0,0,0,0,0,1],output,true),0);
  assert.equal(nativeFrameLayer(new Uint32Array(),[0,1,0,1,1,0],output,false),0);
  assert.equal(output[0],0xdeadbeef);
});

test('display backing resolution honors device density with a 1x floor and 3x ceiling',()=>{
  assert.deepEqual(displayResolution(365,730),{width:365,height:730});
  assert.deepEqual(displayResolution(365,730,2),{width:730,height:1460});
  assert.deepEqual(displayResolution(100,200,0.5),{width:100,height:200});
  assert.deepEqual(displayResolution(100,200,4),{width:300,height:600});
  assert.deepEqual(displayResolution(0,0,3),{width:1,height:1});
});

test('large surfaces stay near the 2.2-megapixel budget while preserving aspect ratio',()=>{
  for(const [width,height,ratio] of [[365,730,3],[1920,1080,2],[3840,2160,3]]){
    const size=displayResolution(width,height,ratio);
    assert.ok(Number.isInteger(size.width)&&size.width>0);
    assert.ok(Number.isInteger(size.height)&&size.height>0);
    // Rounding both dimensions can exceed the continuous budget by a thin edge.
    assert.ok(size.width*size.height<=2200000+size.width+size.height);
    assert.ok(Math.abs(size.width/size.height-width/height)<0.002);
  }
});
