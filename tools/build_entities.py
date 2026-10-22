"""Build src/data/fixtures/bom-entities.geojson from an OpenStreetMap extract.

Geometry is OSM-derived (ODbL) and NOT reviewed against airport plans: every feature carries its
source way ids, a confidence and reviewStatus so the layer can be swapped for client GIS/BIM later
(spec §5.1, §5.3). Input: tools/.osm_cache.json = {nodes:{id:[lon,lat]}, ways:{id:{nds,tags}}},
made from api.openstreetmap.org/api/0.6/map tiles over 72.835–72.89 E, 19.075–19.11 N.
Run: python3 tools/build_entities.py
"""
import json, math, os

HERE = os.path.dirname(__file__)
osm = json.load(open(os.path.join(HERE, '.osm_cache.json')))
N, W = osm['nodes'], osm['ways']
R5 = lambda p: [round(p[0], 7), round(p[1], 7)]

def way_pts(wid):
    return [tuple(N[n]) for n in W[wid]['nds'] if n in N]

def chain(ids):
    """Join ways end-to-start, reversing a way when that is what makes them connect."""
    out = list(way_pts(ids[0]))
    for wid in ids[1:]:
        p = way_pts(wid)
        if out[-1] == p[0]: out += p[1:]
        elif out[-1] == p[-1]: out += list(reversed(p))[1:]
        elif out[0] == p[-1]: out = p[:-1] + out
        else: raise SystemExit(f'way {wid} does not connect to chain {ids}')
    return out

def ring(wid):
    p = way_pts(wid)
    assert p[0] == p[-1], f'way {wid} is not closed'
    return p

def runway_polygon(a, b, width_m):
    lat0 = math.radians((a[1] + b[1]) / 2)
    mx, my = 111320 * math.cos(lat0), 110540
    dx, dy = (b[0] - a[0]) * mx, (b[1] - a[1]) * my
    L = math.hypot(dx, dy); nx, ny = -dy / L * width_m / 2, dx / L * width_m / 2
    off = lambda p, s: (p[0] + s * nx / mx, p[1] + s * ny / my)
    return [off(a, 1), off(b, 1), off(b, -1), off(a, -1), off(a, 1)], round(L)

def feature(fid, geom, **props):
    base = {'id': fid, 'geometryConfidence': 'medium',
            'reviewStatus': 'UNREVIEWED — verify against imagery or authorized airport plans'}
    return {'type': 'Feature', 'id': fid, 'properties': {**base, **props}, 'geometry': geom}

poly = lambda pts: {'type': 'Polygon', 'coordinates': [[R5(p) for p in pts]]}
line = lambda pts: {'type': 'LineString', 'coordinates': [R5(p) for p in pts]}

r0927, len0927 = runway_polygon(way_pts('510399291')[0], way_pts('880517046')[-1], 60)
r1432, len1432 = runway_polygon(way_pts('1554399144')[0], way_pts('510399288')[0], 45)

inbound = ['1222180953', '1222196239', '1122603569', '436222499', '408596502']
outbound = ['1164482241', '436222500', '1222180952', '370067588']
t1_access = ['22860355', '22860195']

features = [
    feature('terminal-t2', poly(ring('315613914')), name='Terminal 2', type='TERMINAL',
            geometrySource='OpenStreetMap way 315613914 (aeroway=terminal)', heightM=42,
            adjacentEntityIds=['road-sahar-inbound', 'road-sahar-outbound', 'parking-t2-mlcp']),
    feature('terminal-t1', poly(ring('61569813')), name='Terminal 1', type='TERMINAL',
            geometrySource='OpenStreetMap way 61569813 (aeroway=terminal)', heightM=22,
            adjacentEntityIds=['road-t1-access']),
    feature('road-sahar-inbound', line(chain(inbound)), name='Sahar Elevated Access Road — to T2', type='ROAD',
            direction='Inbound (WEH → T2 departures/arrivals)', segmentId='SAHAR-EL-IN-01',
            geometrySource='OpenStreetMap ways ' + ', '.join(inbound), adjacentEntityIds=['terminal-t2']),
    feature('road-sahar-outbound', line(chain(outbound)), name='Sahar Elevated Access Road — from T2', type='ROAD',
            direction='Outbound (T2 → WEH)', segmentId='SAHAR-EL-OUT-01',
            geometrySource='OpenStreetMap ways ' + ', '.join(outbound), adjacentEntityIds=['terminal-t2']),
    feature('road-t1-access', line(chain(t1_access)), name='Nehru Road — T1 approach', type='ROAD',
            direction='One-way towards the T1 forecourt (Air Port Road loop)', segmentId='NEHRU-T1-01',
            geometrySource='OpenStreetMap ways ' + ', '.join(t1_access), adjacentEntityIds=['terminal-t1']),
    feature('runway-09-27', poly(r0927), name='Runway 09/27', type='RUNWAY', designator='09/27',
            lengthM=len0927, widthM=60, geometrySource='OpenStreetMap runway centreline (ways 510399291…880517046), buffered to 60 m'),
    feature('runway-14-32', poly(r1432), name='Runway 14/32', type='RUNWAY', designator='14/32',
            lengthM=len1432, widthM=45, geometrySource='OpenStreetMap runway centreline (ways 1554399144…510399288), buffered to 45 m'),
    feature('parking-t2-mlcp', poly(ring('436222501')), name='T2 Multi-Level Car Park', type='PARKING', heightM=24,
            geometrySource='OpenStreetMap way 436222501 (parking=multi-storey)', adjacentEntityIds=['terminal-t2', 'road-sahar-inbound']),
    feature('facility-ga-terminal', poly(ring('706495637')), name='General Aviation Terminal', type='FACILITY',
            facilityType='Terminal (general aviation)', geometrySource='OpenStreetMap way 706495637', heightM=10, adjacentEntityIds=[]),
]
fc = {'type': 'FeatureCollection',
      'attribution': '© OpenStreetMap contributors, ODbL. Geometry is unreviewed demo geometry, not authoritative airport data.',
      'features': features}
dst = os.path.join(HERE, '..', 'src', 'data', 'fixtures', 'bom-entities.geojson')
json.dump(fc, open(dst, 'w'), indent=1)
print('wrote', os.path.normpath(dst), [(f['id'], f['geometry']['type'], len(f['geometry']['coordinates'] if f['geometry']['type'] == 'LineString' else f['geometry']['coordinates'][0])) for f in features], 'runway lengths', len0927, len1432)
