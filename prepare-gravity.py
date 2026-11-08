from pathlib import Path
import sys, json, hashlib
from datetime import datetime, timezone
sys.path.insert(0,str(Path('../tmp/gravity-python').resolve()))
import netCDF4
import numpy as np
source=Path('../tmp/gravity/earth_faa_06m_p.grd')
ds=netCDF4.Dataset(source)
print(ds)
for name,v in ds.variables.items():
    print(name,v.shape,{a:v.getncattr(a) for a in v.ncattrs() if a not in ['actual_range']})
lat=ds.variables['lat'][:];lon=ds.variables['lon'][:];z=ds.variables['z'][:]
assert z.shape==(1800,3600)
assert np.all(np.diff(lat)>0) and np.all(np.diff(lon)>0)
assert abs(lat[0]+89.95)<1e-8 and abs(lon[0]+179.95)<1e-8
values=z.filled(np.nan)
assert np.nanmax(abs(values))<3200
raw=np.where(np.isfinite(values),np.rint(values*10),-32768).astype('<i2')
out=Path('dist/gravity');out.mkdir(exist_ok=True)
(out/'faa-06m.bin').write_bytes(raw.tobytes())
meta={'dataset':'Scripps/IGPP Earth Free-Air Anomaly','distribution':'GMT earth_faa_06m_p','model_over_land':'EGM2008','unit':'mGal','width':3600,'height':1800,'step':0.1,'west':-180,'south':-90,'registration':'pixel','row_order':'south_to_north','scale':0.1,'nodata':-32768,'filter_km':31.5,'coverage_lat':[-80,80],'downloaded':datetime.now(timezone.utc).isoformat(),'source_url':'https://oceania.generic-mapping-tools.org/server/earth/earth_faa/earth_faa_06m_p.grd','documentation_url':'https://www.generic-mapping-tools.org/remote-datasets/earth-faa.html','sha256_source':hashlib.sha256(source.read_bytes()).hexdigest(),'source_attributes':{a:str(ds.getncattr(a)) for a in ds.ncattrs()}}
(out/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
samples=[]
for la,lo in [(-16.758611,-49.344444),(0,0),(40,-100),(-45,170)]:
    y=int((la+90)*10);x=int((lo+180)*10)
    samples.append({'lat':float(lat[y]),'lon':float(lon[x]),'source_value':float(values[y,x]),'packed_value':float(raw[y,x]*.1)})
print(json.dumps({'samples':samples,'bytes':raw.nbytes}))
Path('../tmp/gravity/checks.json').write_text(json.dumps(samples))
