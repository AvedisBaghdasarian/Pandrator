import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, splitForTts, pcmToWavBlob, cleanBlocks } from '../src/core.js';

test('detects golden path formats',()=>{assert.equal(detectFormat({name:'book.epub'}),'epub');assert.equal(detectFormat({name:'book.pdf'}),'pdf');assert.equal(detectFormat({name:'book.txt'}),'text')});
test('chunks text on sentence boundaries',()=>{assert.deepEqual(splitForTts('One. Two. Three.',7),['One.','Two.','Three.'])});
test('applies Pandrator deterministic cleanup roles',()=>{const blocks=[{text:'chapter',role_candidates:['deterministic_chapter']},{text:'toc',role_candidates:['deterministic_toc']},{text:'note',role_candidates:['deterministic_footnote']}];assert.deepEqual(cleanBlocks(blocks).map(x=>x.text),['chapter'])});
test('writes a wav blob',()=>assert.equal(pcmToWavBlob(new Float32Array([0,-.5,.5])).size,50));
