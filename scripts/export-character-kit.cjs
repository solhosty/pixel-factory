// Deterministic source normalization for the generated A reference character.
// Removes the generator's light neutral matte; no character pixels are repainted.
const sharp=require(process.env.PIXEL_SHARP_PATH || 'sharp');
const fs=require('node:fs');
(async()=>{
 const source='docs/design/assets/generated/employee-a-match-v7.png';
 const sourceMetadata=await sharp(source).metadata();
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const idleHeads=new Map();
 const frames=[],report=[];let allLayers={};
 for(let row=0;row<4;row++) for(let col=0;col<6;col++){
  const cell=Buffer.alloc(256*256*4);let minX=256,minY=256,maxX=0,maxY=0;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const src=((row*256+y)*info.width+col*256+x)*4,dst=(y*256+x)*4;
   const [r,g,b]=data.subarray(src,src+3);
   // Background is light neutral gray/white; all silhouette outlines are dark.
   const matte=Math.min(r,g,b)>155 && Math.max(r,g,b)-Math.min(r,g,b)<42;
   cell[dst]=r;cell[dst+1]=g;cell[dst+2]=b;cell[dst+3]=matte?0:255;
   if(!matte){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  const crop={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
  // One source scale for every pose: 0.275 source->logical. Fixed foot anchor.
  const w=Math.round(crop.width*.275),h=Math.round(crop.height*.275);
  const fitted=await sharp(cell,{raw:{width:256,height:256,channels:4}}).extract(crop).resize(w,h,{kernel:'nearest'}).extend({left:Math.floor((48-w)/2),right:Math.ceil((48-w)/2),top:61-h,bottom:3,background:'#00000000'}).raw().toBuffer();
  // Keep the exact idle head/face in all poses: generated frames otherwise morph
  // the face and shift the haircut on each step. Clothing below the collar walks.
  if(col===0)idleHeads.set(row,Buffer.from(fitted.subarray(0,48*31*4)));
  else idleHeads.get(row).copy(fitted,0);
  const layers={base:Buffer.alloc(48*64*4),hair:Buffer.alloc(48*64*4),skin:Buffer.alloc(48*64*4),top:Buffer.alloc(48*64*4),bottom:Buffer.alloc(48*64*4)};
  for(let y=0;y<64;y++)for(let x=0;x<48;x++){
   const i=(y*48+x)*4; const [r,g,b,a]=fitted.subarray(i,i+4);if(!a)continue;
   let layer='base';
   if(y<31 && r>70 && g<r*.70 && b<r*.60)layer='hair';
   if(r>155 && g>100 && b>55 && r>g*1.10 && (y>18 && (row!==3 || y>35)))layer='skin';
   if(y>=28 && y<49 && g>=r*.95 && g>b*1.03 && g>30)layer='top';
   if(y>=43 && y<57 && b>=r*.95 && g>=r && r<110)layer='bottom';
   fitted.copy(layers[layer],i,i,i+4);
  }
  const encoded={};for(const [name,pixels]of Object.entries(layers)){
   const png=await sharp(pixels,{raw:{width:48,height:64,channels:4}}).png().toBuffer();
   encoded[name]='data:image/png;base64,'+png.toString('base64');
   await sharp(pixels,{raw:{width:48,height:64,channels:4}}).png().toFile(`static/assets/characters/a-v1/${row}-${col}-${name}.png`);
  }
  const png=await sharp(fitted,{raw:{width:48,height:64,channels:4}}).png().toBuffer();
  await sharp(png).toFile(`static/assets/characters/a-v1/${row}-${col}.png`);
  frames.push(encoded);report.push({row,col,crop,canvas:[48,64],anchor:[24,61],scale:.275,opaquePixels:[...fitted].filter((_,i)=>i%4===3&&fitted[i]===255).length});
 }
 fs.writeFileSync('src/lib/office/character-kit.json',JSON.stringify(frames));
 fs.writeFileSync('docs/evidence/1B-design-match/character-export.json',JSON.stringify({source,sourceHasAlpha:sourceMetadata.hasAlpha,matte:'light neutral pixels, min channel >155, spread <42',frames:report},null,2));
 const composites=[];for(let row=0;row<4;row++)for(let col=0;col<6;col++)composites.push({input:await sharp(`static/assets/characters/a-v1/${row}-${col}.png`).resize(96,128,{kernel:'nearest'}).toBuffer(),left:col*112+8,top:row*144+8});
 await sharp({create:{width:672,height:576,channels:4,background:'#5c6267'}}).composite(composites).png().toFile('docs/evidence/1B-design-match/character-grid.png');
})();
