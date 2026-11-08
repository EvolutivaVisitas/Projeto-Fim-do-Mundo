import {distance,summarize} from './analysis.mjs';
export const GRAVITY={width:3600,height:1800,step:.1,scale:.1,nodata:-32768};
let loading;
export function loadGravity(onProgress=()=>{}){
  if(!loading)loading=(async()=>{
    const response=await fetch('gravity/faa-06m.bin',{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw Error('Não foi possível carregar a grade gravitacional. HTTP '+response.status);
    const expected=GRAVITY.width*GRAVITY.height*2,buffer=new Uint8Array(expected);
    let received=0;
    if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;if(received+value.length>expected)throw Error('Tamanho inválido da grade gravitacional.');buffer.set(value,received);received+=value.length;onProgress(received/expected);}}
    else {const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==expected)throw Error('Grade gravitacional incompleta.');buffer.set(bytes);received=bytes.length;}
    if(received!==expected)throw Error('Grade gravitacional incompleta. Tente novamente.');
    // The packed file is explicitly little-endian, independent of browser architecture.
    const view=new DataView(buffer.buffer),values=new Int16Array(expected/2);for(let i=0;i<values.length;i++)values[i]=view.getInt16(i*2,true);
    return values;
  })().catch(e=>{loading=undefined;throw e;});
  return loading;
}
export function valueAt(values,lat,lon){if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>=80)return NaN;const x=Math.floor((((lon+180)%360+360)%360)*10),y=Math.floor((lat+90)*10);const raw=values[y*3600+x];return raw===GRAVITY.nodata||raw===undefined?NaN:raw*.1;}
export function analyzeGravity(values,lat,lon,radius){
  if(!Number.isFinite(lat)||Math.abs(lat)>=80)throw Error('A grade gravitacional cobre latitudes entre 80°S e 80°N, sem os polos.');
  if(!Number.isFinite(lon)||Math.abs(lon)>180||![25,50,100,200].includes(radius))throw Error('Coordenadas ou raio inválidos.');
  const points=[],dy=(radius+30)/110,dx=(radius+30)/(110*Math.cos(lat*Math.PI/180));
  for(let y=Math.max(0,Math.floor((lat-dy+90)*10));y<Math.min(1800,Math.ceil((lat+dy+90)*10));y++){
    for(let ix=Math.floor((lon-dx+180)*10);ix<Math.ceil((lon+dx+180)*10);ix++){
      const x=(ix%3600+3600)%3600,la=-90+(y+.5)/10,lo=-180+(x+.5)/10,km=distance(lat,lon,la,lo);
      if(km>radius+25)continue;
      points.push({lat:la,lon:lo,km,x,y,value:valueAt(values,la,lo)});
    }
  }
  return {...summarize(points,lat,lon,radius,3600),mode:'gravity',source:'Scripps/IGPP v33.1 · GMT · EGM2008 em terra',unit:'mGal',resolution_arcmin:6,filter_km:31.5};
}
export function gravityColor(value){if(!Number.isFinite(value))return [0,0,0,0];const t=Math.min(Math.abs(value)/150,1),end=value<0?[44,91,181]:[197,67,30];return [Math.round(247+(end[0]-247)*t),Math.round(247+(end[1]-247)*t),Math.round(243+(end[2]-243)*t),190];}
export function makeGravityLayer(L,values){return new (L.GridLayer.extend({createTile(coords){
  const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d'),pixels=ctx.createImageData(128,128),n=2**coords.z;
  const longitude=Array.from({length:128},(_,x)=>(coords.x+(x+.5)/128)/n*360-180);
  for(let y=0;y<128;y++){const merc=Math.PI*(1-2*(coords.y+(y+.5)/128)/n),lat=Math.atan(Math.sinh(merc))*180/Math.PI;for(let x=0;x<128;x++){pixels.data.set(gravityColor(valueAt(values,lat,longitude[x])),(y*128+x)*4);}}
  ctx.putImageData(pixels,0,0);return tile;
}}))({tileSize:256,opacity:.8,maxZoom:15,attribution:'Scripps/IGPP v33.1 · EGM2008 · GMT'});}
