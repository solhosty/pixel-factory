const sharp=require(process.env.PIXEL_SHARP_PATH || 'sharp');
const fs=require('node:fs');
(async()=>{
 const checks=[];
 for(let row=0;row<4;row++)for(let column=0;column<6;column++){
  const root=`static/assets/characters/a-v1/${row}-${column}`;
  const {data,info}=await sharp(root+'.png').raw().toBuffer({resolveWithObject:true});
  const layers=await Promise.all(['base','hair','skin','top','bottom'].map(name=>sharp(root+'-'+name+'.png').raw().toBuffer()));
  let exact=true,border=true,foot=-1;
  for(let y=0;y<64;y++)for(let x=0;x<48;x++){
   const i=(y*48+x)*4;
   if(layers.reduce((sum,layer)=>sum+layer[i+3],0)!==data[i+3])exact=false;
   if(data[i+3]){foot=Math.max(foot,y);if(x<2||x>=46||y<2||y>=62)border=false;}
   for(let channel=0;channel<3;channel++)if(layers.reduce((sum,layer)=>sum+(layer[i+3]?layer[i+channel]:0),0)!==(data[i+3]?data[i+channel]:0))exact=false;
  }
  if(!exact||!border||info.width!==48||info.height!==64)throw Error(`${row}-${column} failed`);
  checks.push({row,column,exactLayerRecomposition:exact,transparentSafetyBorder:border,bottomOpaqueRow:foot});
 }
 fs.writeFileSync('docs/evidence/1B-design-match/layer-checks.json',JSON.stringify(checks,null,2));
 console.log('24 frames: exact disjoint layer recomposition and transparent borders passed');
})();
