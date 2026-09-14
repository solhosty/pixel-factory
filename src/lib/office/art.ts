import characterKit from './character-kit.json';
// Original grid-authored artwork. All coordinates are integer logical pixels.
const ink = '#302a2c';
const rect = (x:number,y:number,w:number,h:number,c:string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const svg = (w:number,h:number,content:string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${content}</svg>`)}`;
const spriteCache = new Map<string,string>();
export function portrait(recipe:Record<string,string> = {}, direction = 0, frame = 0, bust = false) {
 const key=JSON.stringify([recipe,direction,frame,bust]);const cached=spriteCache.get(key);if(cached)return cached;
 const layers=characterKit[Math.max(0,Math.min(3,direction))*6+Math.max(0,Math.min(5,frame))];
 const tint=(id:string,r:number,g:number,b:number,base:number)=>`<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${r/base}"/><feFuncG type="linear" slope="${g/base}"/><feFuncB type="linear" slope="${b/base}"/></feComponentTransfer></filter>`;
 const filters=tint('umber',156,105,77,181)+tint('sienna',201,143,101,181)+tint('dark',66,49,42,111)+tint('ink',49,48,56,111)+tint('navy',76,91,111,66)+tint('cream',184,178,153,66);
 const skin=recipe.skin==='umber-02'?'umber':recipe.skin==='sienna-01'?'sienna':'';
 const hair=recipe.hair==='curl-dark-01'?'dark':recipe.hair==='crop-ink-01'?'ink':'';
 const top=recipe.top==='cardigan-navy-01'?'navy':recipe.top==='shirt-cream-01'?'cream':'';
 const layer=(src:string,filter='')=>`<image href="${src}" width="48" height="64" style="image-rendering:pixelated"${filter?` filter="url(#${filter})"`:''}/>`;
 const glasses=recipe.accessory?.includes('glasses')&&direction===0?`<path d="M17 21h6v5h-6zM26 21h6v5h-6zM23 23h3" fill="none" stroke="#584932" stroke-width="1"/>`:'';
 const accent=recipe.accent==='terracotta-01'?'#b7744e':recipe.accent==='indigo-01'?'#8d97b7':'#a6b28b';
 const badge=direction===0?rect(30,36,2,2,accent):'';
 const result=svg(48,64,`<defs>${filters}</defs>`+layer(layers.base)+layer(layers.bottom)+layer(layers.skin,skin)+layer(layers.top,top)+layer(layers.hair,hair)+glasses+badge);
 if(spriteCache.size>1024)spriteCache.clear();const output=bust?result.replace(encodeURIComponent('viewBox="0 0 48 64"'),encodeURIComponent('viewBox="6 0 36 36"')).replace(encodeURIComponent('width="48" height="64"'),encodeURIComponent('width="36" height="36"')):result;spriteCache.set(key,output);return output;
}
const plant = (x:number,y:number) => rect(x+5,y+13,10,9,'#513a31')+rect(x+6,y+13,8,7,'#b57955')+rect(x+8,y+5,2,10,'#586444')+rect(x+1,y+4,7,5,'#45573c')+rect(x+3,y+3,6,3,'#7b8b50')+rect(x+11,y+1,6,6,'#526b40')+rect(x+12,y+1,3,3,'#91a35c')+rect(x+8,y+7,9,5,'#698048')+rect(x,y+9,8,5,'#5c7545');
export const art:Record<string,string> = {
 floor:svg(16,16,rect(0,0,16,16,'#a67448')+rect(0,0,16,1,'#ae7a4c')+rect(0,7,16,1,'#95623f')+rect(7,1,1,6,'#8c5e3b')+rect(2,3,4,1,'#b78250')+rect(9,5,6,1,'#99653e')+rect(0,15,16,1,'#8b5d3c')+rect(12,8,1,7,'#8a5937')+rect(2,11,8,1,'#b5804f')),
 wall:svg(16,16,rect(0,0,16,16,'#bca585')+rect(0,1,16,9,'#e2cba5')+rect(0,10,16,2,'#957453')+rect(0,12,16,4,'#654634')+rect(0,12,16,1,'#a27951')),
 desk:svg(96,80,rect(17,58,64,5,'#654631')+rect(19,43,5,16,ink)+rect(72,43,5,16,ink)+rect(16,25,64,22,ink)+rect(17,24,62,19,'#875438')+rect(18,25,60,2,'#c58c54')+rect(19,30,57,1,'#9f6940')+rect(19,42,58,4,'#62402e')+rect(21,47,16,10,'#684833')+rect(22,48,14,2,'#a16d43')+rect(27,51,5,1,'#d6ac67')+rect(40,19,25,17,ink)+rect(42,21,21,12,'#536571')+rect(44,23,9,1,'#9dad91')+rect(44,26,14,1,'#708c88')+rect(49,36,8,2,ink)+rect(43,39,20,3,'#c0b79b')+rect(69,32,5,5,'#d8c7a1')+rect(70,32,3,1,'#4b3930')+rect(25,22,2,13,ink)+rect(22,21,9,3,'#ddbb72')+rect(25,18,4,3,'#b58b4b')+rect(20,37,12,3,'#5f785b')+rect(21,36,10,1,'#e2ce9f')),
 bookcase:svg(64,64,rect(16,16,32,32,ink)+rect(17,16,30,3,'#c08b54')+rect(18,19,28,26,'#674733')+[20,32].map(y=>[20,25,30,35,40].map((x,i)=>rect(x,y,4,9,['#748273','#b68154','#d0bb88','#5c6a78','#936254'][i])+rect(x,y+2,4,1,'#e8cf9955')).join('')+rect(18,30,28,2,'#bb8954')+rect(18,43,28,3,'#b1814e')).join('')),
 plant:svg(64,64,plant(22,20)),
 window:svg(96,64,rect(16,16,64,32,'#624734')+rect(18,17,60,29,'#b48957')+rect(21,19,54,23,'#f0ce8d')+rect(23,21,50,18,'#f6dfa7')+rect(23,32,10,7,'#ceae80')+rect(34,29,9,10,'#d5b788')+rect(58,31,15,8,'#cfb58c')+rect(46,19,3,23,'#91673d')+rect(21,29,54,2,'#a87a45')+rect(17,44,62,3,'#dbb87b')),
 notice:svg(64,64,rect(16,16,32,32,'#513c2f')+rect(18,18,28,28,'#be8e59')+rect(21,22,9,13,'#eee0b7')+rect(34,26,8,12,'#b96144')+rect(23,24,5,1,'#9e967b')+rect(23,27,5,1,'#9e967b')+rect(35,28,6,1,'#e9c28f')),
 chair:svg(64,64,rect(24,23,17,16,ink)+rect(25,22,15,10,'#53645d')+rect(26,23,13,2,'#849080')+rect(24,34,17,8,'#374840')+rect(26,34,13,4,'#6c7d6a')+rect(25,42,3,4,ink)+rect(37,42,3,4,ink)),
 rug:svg(112,96,rect(16,16,80,64,'#695c3e')+rect(18,18,76,60,'#7b8050')+`<path d="M22 22h68v52H22zM26 26h60v44H26zM56 31l19 17-19 17-19-17z" fill="none" stroke="#b4a36a" stroke-width="2"/>`),
};

// Cohesive source-family exports. These were previously retained only in the
// design archive while the runtime still used the flatter placeholder set.
Object.assign(art, {
 floor: '/assets/office-v2/floor-plank.png',
 wall: '/assets/office-v2/wall-cream.png',
 desk: '/assets/office-v2/desk-workstation.png',
 bookcase: '/assets/office-v2/bookcase-walnut.png',
 chair: '/assets/office-v2/chair-blue.png',
 plant: '/assets/office-v2/plant-large.png',
 'plant-small': '/assets/office-v2/plant-small.png',
 rug: '/assets/office-v2/rug-large.png',
 window: '/assets/office-v2/window-wall.png',
 notice: '/assets/office-v2/corkboard.png',
 lamp: '/assets/office-v2/lamp-floor.png',
 coat: '/assets/office-v2/coat-stand.png',
 'file-box': '/assets/office-v2/file-box.png',
 loveseat: '/assets/office-v2/loveseat-moss.png',
 stool: '/assets/office-v2/stool.png',
 laptop: '/assets/office-v2/laptop.png',
 terminal: '/assets/office-v2/terminal-monitor.png',
});

art.monitor=svg(32,24,rect(2,2,27,17,ink)+rect(3,3,25,14,"#3f4d52")+rect(5,5,12,1,"#acb891")+rect(5,8,18,1,"#839f91")+rect(5,11,9,1,"#c49d73")+rect(13,19,5,3,ink)+rect(9,22,13,1,ink));
