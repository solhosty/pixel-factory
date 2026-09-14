import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {seated,sleeping,furniture,walkBox,spriteAtlas} from '../sprites.ts';

function assertCrop(file, box) {
 const bytes=readFileSync(new URL(`../../../../static/assets/studio-v3/${file}.png`,import.meta.url));
 assert.equal(bytes.toString('ascii',1,4),'PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 const [x,y,w,h]=box;
 assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`${file}: crop ${box} exceeds ${width} × ${height}`);
}

test('both hairstyles supply every directional walk, seat, sleep and portrait crop',()=>{
 for(const hair of ['short-auburn-03','crop-ink-01']) {
  for(const [kind,box] of Object.entries(seated)) assertCrop(spriteAtlas(true,kind,'seated',hair),box);
  for(const [kind,box] of Object.entries(sleeping)) assertCrop(spriteAtlas(true,kind,'sleeping',hair),box);
  for(let direction=0;direction<4;direction++)for(let frame=0;frame<6;frame++)assertCrop(spriteAtlas(true,'','walking',hair),walkBox(direction,frame));
 }
});
test('every furniture and persistent-chair crop has a source inside atlas bounds',()=>{
 for(const [kind,box] of Object.entries(furniture))assertCrop(spriteAtlas(false,kind,''),box);
});
