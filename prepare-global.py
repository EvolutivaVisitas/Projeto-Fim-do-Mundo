from pathlib import Path
import sys,json,hashlib
import numpy as np
sys.path.insert(0,str(Path('../tmp/gravity-python').resolve()))
import netCDF4
from datetime import datetime,timezone
out=Path('dist/global');out.mkdir(exist_ok=True)
ds=netCDF4.Dataset('../tmp/gravity/earth_mag4km_06m_p.grd')
z=ds.variables['z'][:].filled(np.nan)
assert z.shape==(1800,3600)
assert abs(float(ds.variables['lat'][0])+89.95)<1e-6
assert np.nanmax(abs(z))<13106
raw=np.where(np.isfinite(z),np.rint(z/.4),-32768).astype('<i2')
(out/'magnetic-06m.bin').write_bytes(raw.tobytes())
meta={'source':'NOAA EMAG2 v3 via GMT earth_mag4km_06m_p','unit':'nT','scale':.4,'nodata':-32768,'resolution_arcmin':6,'filter_km':31.5,'altitude_km':4,'source_url':'https://oceania.generic-mapping-tools.org/server/earth/earth_mag4km/earth_mag4km_06m_p.grd','attributes':{a:str(ds.getncattr(a)) for a in ds.ncattrs()},'source_sha256':hashlib.sha256(Path('../tmp/gravity/earth_mag4km_06m_p.grd').read_bytes()).hexdigest()}
(out/'magnetic-metadata.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
lat=-90+(np.arange(1800)+.5)/10
for mode,file,scale in [('magnetic',out/'magnetic-06m.bin',.4),('gravity',Path('dist/gravity/faa-06m.bin'),.1)]:
    a=np.fromfile(file,dtype='<i2').reshape(1800,3600);valid=a!=-32768
    if mode=='gravity':valid &= abs(lat[:,None])<80
    v=np.where(valid,a.astype(float)*scale,np.nan)
    right=np.roll(v,-1,axis=1);left=np.roll(v,1,axis=1)
    dx=6371.0088*2*np.arcsin(np.cos(np.radians(lat))*np.sin(np.radians(.1)))
    gx=(right-left)/dx[:,None]
    gy=np.full(v.shape,np.nan);gy[1:-1]=(v[2:]-v[:-2])/(6371.0088*np.radians(.2))
    gradient=np.hypot(gx,gy);gradient[~valid]=np.nan
    ranks={}
    for typ,field,mask,asc in [('positive',v,valid&(v>0),False),('negative',v,valid&(v<0),True),('gradient',gradient,np.isfinite(gradient),False)]:
        ids=np.flatnonzero(mask);scores=field.ravel()[ids];k=min(10,len(ids));chosen=np.argpartition(scores,k-1)[:k] if asc else np.argpartition(-scores,k-1)[:k];chosen=chosen[np.argsort(scores[chosen] if asc else -scores[chosen])]
        rows=[]
        for idx in ids[chosen]:
            y,x=divmod(int(idx),3600);g=float(gradient[y,x]);rows.append({'lat':round(float(lat[y]),5),'lon':round(-180+(x+.5)/10,5),'value':round(float(v[y,x]),3),'gradient':g if np.isfinite(g) else None,'km':None})
        ranks[typ]=rows
    summary={'mode':mode,'scope':'global','radius':'global','date':datetime.now(timezone.utc).isoformat(),'total':int(valid.size),'validCount':int(valid.sum()),'min':float(np.nanmin(v)),'max':float(np.nanmax(v)),'ranks':ranks,'points':list({(p['lat'],p['lon']):p for rows in ranks.values() for p in rows}.values()),'resolution_arcmin':6,'filter_km':31.5,'source':meta['source'] if mode=='magnetic' else 'Scripps/IGPP v33.1 via GMT; EGM2008 em terra','unit':'nT' if mode=='magnetic' else 'mGal'}
    (out/(mode+'-summary.json')).write_text(json.dumps(summary),encoding='utf8')
    print(mode,summary['validCount'],summary['min'],summary['max'])
