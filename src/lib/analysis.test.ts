import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, localAudience, localFeedback, wordsOf } from './analysis';
test('word analysis handles punctuation, contractions and Unicode text',()=>{assert.equal(wordsOf("Hello, world! We’re here. नमस्ते 2026").length,6);});
test('filler matching counts complete phrases without matching normal word fragments',()=>{const result=analyze('A museum has aluminum. Um, uh, you know, kind of interesting.',30,'voice');assert.equal(result.fillers,4);});
test('pace is based on active time and withheld for insufficient voice evidence',()=>{assert.equal(analyze('one two three four five six',30,'voice').pace,12);assert.equal(analyze('one two three four five six',8,'voice').pace,null);assert.equal(analyze('',30,'voice').pace,null);});
test('typed input never produces a speaking pace',()=>{assert.equal(analyze('one two three four five six',30,'typed').pace,null);});
test('local audience respects temperament and remains bounded across extreme data',()=>{const metrics=analyze('one two three four five six',30,'voice');assert.ok(localAudience(metrics,'supportive').engagement>localAudience(metrics,'challenging').engagement);for(const mood of ['supportive','neutral','challenging'] as const){for(const pace of [0,140,1000]){const result=localAudience({...metrics,words:400,fillers:200,pace},mood);assert.ok(result.engagement>=30&&result.engagement<=94);}}});
test('empty speech receives an opening suggestion without content praise',()=>{assert.match(localFeedback(analyze('',60,'voice'),'Leadership').improvement,/Leadership/);assert.match(localFeedback(analyze('',60,'voice'),'Leadership').strength,/single sentence/);});
