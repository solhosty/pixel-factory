/** Atlas coordinates are source pixels; scene sizes and feet anchors are map units. */
export type SpriteBox = [number, number, number, number];
export const furniture: Record<string, SpriteBox> = {
 pendant:[136,50,220,375],clock:[595,82,333,342],painting:[1063,110,378,306],filing:[106,503,216,477],lowShelf:[452,533,550,413],wallShelf:[1046,580,450,395],
 'chair-south':[190,170,300,380],'chair-west':[770,180,270,370],'chair-east':[215,735,280,365],'chair-north':[765,745,300,365],
 'desk-east':[213,67,398,835],'desk-west':[922,67,403,835],
 window:[26,92,425,371],bookcase:[491,28,334,446],notice:[879,76,330,399],
 desk:[20,492,451,363],writing:[492,526,353,330],coffee:[887,524,352,335],
 plant:[84,866,282,355],rug:[437,929,389,274],coat:[888,875,166,349],cat:[1030,1048,207,175]
};
export const seated: Record<string, SpriteBox> = {
 south:[94,108,260,434],west:[491,108,271,434],east:[891,108,269,434],
 north:[94,680,260,454],standing:[490,680,262,454],back:[892,680,262,454],bust:[94,108,260,270]
};
export const sleeping: Record<string, SpriteBox> = {
 west:[143,122,333,442],east:[751,122,332,442],south:[192,653,311,480],north:[766,666,300,467]
};
export function walkBox(direction:number, frame:number):SpriteBox {
 return [[72,310,550,790,1040,1300][frame%6], [22,258,498,738][direction], 160, 226];
}
const atlasCache=new Map<string,Promise<HTMLImageElement>>();
export function loadAtlas(file:string){
 let pending=atlasCache.get(file);
 if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Could not load sprite atlas: ${file}`));image.src=`/assets/studio-v3/${file}.png`;});atlasCache.set(file,pending);}
 return pending;
}
/** Chroma-key and palette decoding are rendering operations; source atlases stay intact. */
export function drawSprite(canvas:HTMLCanvasElement,image:HTMLImageElement,box:SpriteBox,recipe:Record<string,string>,character:boolean,bust=false){
 const width=character?48:Math.min(450,box[2]);const height=character?(bust?50:80):Math.round(width*box[3]/box[2]);
 canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;ctx.drawImage(image,...box,0,0,width,height);
 const pixels=ctx.getImageData(0,0,width,height),data=pixels.data;
 for(let i=0;i<data.length;i+=4){
  const r=data[i],g=data[i+1],b=data[i+2];
  if(r>40&&b>40&&r>g*1.55&&b>g*1.45){data[i+3]=0;continue;}
  if(!character)continue;
  const y=Math.floor(i/4/width)/height;
  // Hair colors are the saturated copper ramp. Skin is a much lighter ramp;
  // the head-region bound excludes tan shoes in the walking and seated sheets.
  if(recipe.hair!=='crop-ink-01'&&y<(bust?1:.53)&&r>g*1.42&&g>b*1.3&&r<250&&g<195&&b<r*.49&&g<r*.75){
   const shade=r/180;
   if(recipe.hair==='curl-dark-01'){data[i]=64*shade;data[i+1]=49*shade;data[i+2]=42*shade;}
  }else if((bust||y<.82)&&r>185&&g>125&&r>g*1.2&&g>b*1.15){
   if(recipe.skin==='umber-02'){data[i]=r*.67;data[i+1]=g*.62;data[i+2]=b*.64;}
   else if(recipe.skin==='sienna-01'){data[i]=r*.86;data[i+1]=g*.8;data[i+2]=b*.82;}
  }else if(y>.35&&g>r*1.1&&g>b*1.05){
   const shade=g/85;
   if(recipe.top==='cardigan-navy-01'){data[i]=53*shade;data[i+1]=65*shade;data[i+2]=84*shade;}
   else if(recipe.top==='shirt-cream-01'){data[i]=146*shade;data[i+1]=136*shade;data[i+2]=110*shade;}
  }
 }
 ctx.putImageData(pixels,0,0);
}

/** Every hairstyle resolves a whole family; no state silently falls back. */
export function spriteAtlas(character: boolean, kind: string, mode: string, hair = ''): string {
 if (!character) {
  if (['pendant','clock','painting','filing','lowShelf','wallShelf'].includes(kind)) return 'decor-atlas';
  return kind.startsWith('chair-') ? 'chairs' : kind.startsWith('desk-') ? 'side-desks' : 'furniture-atlas-v2';
 }
 const base = mode === 'walking' ? 'walk-atlas' : mode === 'sleeping' ? 'sleep-body' : 'character-body';
 return hair === 'crop-ink-01' ? `${base}-ink` : base;
}
