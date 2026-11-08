import fs from 'node:fs/promises';
const url='https://oceania.generic-mapping-tools.org/server/earth/earth_faa/earth_faa_06m_p.grd';
await fs.mkdir('../tmp/gravity',{recursive:true});
const r=await fetch(url);if(!r.ok)throw Error('Gravity download HTTP '+r.status);
await fs.writeFile('../tmp/gravity/earth_faa_06m_p.grd',Buffer.from(await r.arrayBuffer()));console.log('Gravity source downloaded');
