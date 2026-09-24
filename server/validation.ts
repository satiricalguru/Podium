import { z } from 'zod';
export const requestSchema = z.object({
  mode: z.enum(['reaction','question','feedback']),
  topic: z.string().trim().min(1).max(200),
  temperament: z.enum(['supportive','neutral','challenging']),
  transcript: z.string().max(12000),
  metrics: z.object({words:z.number().int().min(0).max(100000), fillers:z.number().int().min(0).max(100000), pace:z.number().int().min(0).max(5000).nullable(), seconds:z.number().int().min(0).max(7200), mode:z.enum(['voice','typed'])})
});
export const directionSchema = z.object({ engagement:z.number().min(20).max(95), reaction:z.enum(['engaged','curious','distracted']), cue:z.string().min(1).max(280), question:z.string().min(1).max(500), strength:z.string().min(1).max(600), improvement:z.string().min(1).max(600) });
export const responseJsonSchema = { type:'object', properties:{ engagement:{type:'number',minimum:20,maximum:95}, reaction:{type:'string',enum:['engaged','curious','distracted']}, cue:{type:'string'}, question:{type:'string'}, strength:{type:'string'}, improvement:{type:'string'} }, required:['engagement','reaction','cue','question','strength','improvement'], additionalProperties:false };
