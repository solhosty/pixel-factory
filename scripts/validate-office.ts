import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {art,portrait} from '../src/lib/office/art';
const frames=[];
for(let row=0;row<4;row++) for(let frame=0;frame<6;frame++) {
 const source=decodeURIComponent(portrait({skin:'golden-01',hair:'short-auburn-03',top:'overshirt-moss-01'},row,frame).split(',')[1]);
 assert(source.includes('width="48" height="64"')); frames.push(source);
}
assert(new Set(frames).size>=20);
assert.notEqual(portrait({top:'shirt-cream-01'}),portrait({top:'overshirt-moss-01'}));
assert.notEqual(portrait({hair:'short-auburn-03'}),portrait({hair:'curl-dark-01'}));
const embed=(url:string,x:number,y:number,w:number,h:number)=>`<image href="${url.replaceAll('&','&amp;')}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
let gallery='';for(let r=0;r<4;r++)for(let f=0;f<6;f++)gallery+=embed(portrait({skin:'golden-01',hair:'short-auburn-03',top:'overshirt-moss-01'},r,f),f*72+16,r*90+16,48,64);
writeFileSync('docs/evidence/1B-design-match/character-grid.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="448" height="376"><defs><pattern id="check" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e5ddcd"/><path d="M0 0h8v8H0zM8 8h8v8H8z" fill="#cdc5b7"/></pattern></defs><rect width="100%" height="100%" fill="url(#check)"/>${gallery}</svg>`);
console.log('24 directional frames, distinct walk poses, and recipe substitutions validated.');
let tiles=''; for(let y=0;y<4;y++) for(let x=0;x<4;x++){tiles+=embed(art.floor,x*32,y*32,32,32);tiles+=embed(art.wall,144+x*32,y*32,32,32);}
writeFileSync('docs/evidence/1B-design-match/tile-repeat.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="272" height="128">${tiles}</svg>`);
