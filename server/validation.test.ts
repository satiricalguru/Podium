import test from 'node:test';
import assert from 'node:assert/strict';
import {directionSchema,requestSchema} from './validation';
const valid={mode:'reaction',topic:'Leadership',temperament:'supportive',transcript:'A great leader listens.',metrics:{words:4,fillers:0,pace:null,seconds:10,mode:'typed'}};
test('audience request accepts observed text with unavailable pace',()=>{assert.ok(requestSchema.safeParse(valid).success);});
test('audience request rejects unbounded text, invalid modes and negative metrics',()=>{assert.equal(requestSchema.safeParse({...valid,transcript:'x'.repeat(12001)}).success,false);assert.equal(requestSchema.safeParse({...valid,mode:'execute'}).success,false);assert.equal(requestSchema.safeParse({...valid,metrics:{...valid.metrics,seconds:-1}}).success,false);});
test('director responses reject unsafe animation values and unexpected reaction names',()=>{const value={engagement:75,reaction:'engaged',cue:'Pause.',question:'What next?',strength:'A concrete example.',improvement:'Add a takeaway.'};assert.ok(directionSchema.safeParse(value).success);assert.equal(directionSchema.safeParse({...value,engagement:999}).success,false);assert.equal(directionSchema.safeParse({...value,reaction:'execute'}).success,false);assert.equal(directionSchema.safeParse({...value,cue:'x'.repeat(281)}).success,false);});
