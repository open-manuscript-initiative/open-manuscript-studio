import { useRef, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

type Geometry = { type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon'; coordinates: unknown };
type Feature = { id: string; name: string; geometry: Geometry; period: string; source: string; notes: string };
type Workspace = { title: string; crs: string; features: Feature[] };
const blank = (): Workspace => ({ title: '', crs: 'WGS 84 (EPSG:4326)', features: [] });
const isWorkspace = (value: unknown): value is Workspace => Boolean(value && typeof value === 'object' && typeof (value as Workspace).title === 'string' && Array.isArray((value as Workspace).features));
const makePoint = (): Feature => ({ id: newWorkspaceId(), name: '', geometry: { type: 'Point', coordinates: [0, 0] }, period: '', source: '', notes: '' });
const text = {
  hu: { title: 'Térinformatikai kutatótér', intro: 'Helyhez kötött kutatási objektumok és források nyilvántartása. GeoJSON-import és -export; az alkalmazás nem módosítja a koordinátarendszert.', project: 'Projekt címe', crs: 'Koordinátarendszer', features: 'Térbeli objektumok', add: 'Pont hozzáadása', import: 'GeoJSON importálása', export: 'GeoJSON exportálása', name: 'Megnevezés', geometry: 'Geometria', longitude: 'Hosszúság (kelet)', latitude: 'Szélesség (észak)', coordinates: 'Koordináták (GeoJSON)', period: 'Időszak', source: 'Forrás / rekord URL-je', notes: 'Megjegyzések', remove: 'Törlés', error: 'A fájl nem érvényes GeoJSON FeatureCollection.', empty: 'Még nincs térbeli objektum.', note: 'A GeoJSON koordinátákat a megadott CRS szerint kell értelmezni. Az importált objektumok geometriája változatlanul megmarad.' },
  en: { title: 'Spatial research workspace', intro: 'Register place-based research objects and sources. Import and export GeoJSON; the application does not reproject coordinates.', project: 'Project title', crs: 'Coordinate reference system', features: 'Spatial features', add: 'Add point', import: 'Import GeoJSON', export: 'Export GeoJSON', name: 'Name', geometry: 'Geometry', longitude: 'Longitude', latitude: 'Latitude', coordinates: 'Coordinates (GeoJSON)', period: 'Period', source: 'Source / record URL', notes: 'Notes', remove: 'Remove', error: 'The file is not a valid GeoJSON FeatureCollection.', empty: 'No spatial features yet.', note: 'Interpret GeoJSON coordinates using the declared CRS. Imported geometries are preserved without alteration.' },
  de: { title: 'Arbeitsbereich Geoinformation', intro: 'Ortsbezogene Forschungsobjekte und Quellen erfassen. GeoJSON-Import und -Export; Koordinaten werden nicht umprojiziert.', project: 'Projekttitel', crs: 'Koordinatenreferenzsystem', features: 'Räumliche Objekte', add: 'Punkt hinzufügen', import: 'GeoJSON importieren', export: 'GeoJSON exportieren', name: 'Bezeichnung', geometry: 'Geometrie', longitude: 'Längengrad', latitude: 'Breitengrad', coordinates: 'Koordinaten (GeoJSON)', period: 'Zeitraum', source: 'Quelle / Datensatz-URL', notes: 'Anmerkungen', remove: 'Entfernen', error: 'Die Datei ist keine gültige GeoJSON-FeatureCollection.', empty: 'Noch keine räumlichen Objekte.', note: 'GeoJSON-Koordinaten sind gemäß dem angegebenen Koordinatenreferenzsystem zu interpretieren. Importierte Geometrien bleiben unverändert.' },
} as const;
const geometryTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'] as const;
function isGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  return geometryTypes.includes(geometry.type as typeof geometryTypes[number]) && geometry.coordinates !== undefined;
}
export function SpatialResearchPanel({ locale = 'hu', storageKey = 'spatial-research' }: { locale?: string; storageKey?: string }) {
  const t = text[locale as keyof typeof text] ?? text.hu;
  const [workspace, setWorkspace] = useLocalWorkspace<Workspace>(storageKey, blank, isWorkspace);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const update = (id: string, patch: Partial<Feature>) => setWorkspace(current => ({ ...current, features: current.features.map(feature => feature.id === id ? { ...feature, ...patch } : feature) }));
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || (parsed as { type?: unknown }).type !== 'FeatureCollection' || !Array.isArray((parsed as { features?: unknown }).features)) throw new Error('invalid');
      const features = (parsed as { features: unknown[] }).features.map((item): Feature => {
        if (!item || typeof item !== 'object') throw new Error('invalid');
        const value = item as { geometry?: unknown; properties?: Record<string, unknown>; id?: unknown };
        if (!isGeometry(value.geometry)) throw new Error('invalid');
        const properties = value.properties ?? {};
        return { id: String(value.id ?? newWorkspaceId()), name: String(properties.name ?? properties.title ?? ''), geometry: value.geometry, period: String(properties.period ?? ''), source: String(properties.source ?? ''), notes: String(properties.notes ?? '') };
      });
      setWorkspace(current => ({ ...current, features: [...current.features, ...features] }));
      setError('');
    } catch { setError(t.error); }
  }
  const collection = { type: 'FeatureCollection', name: workspace.title, omiCoordinateReferenceSystem: workspace.crs, features: workspace.features.map(feature => ({ type: 'Feature', id: feature.id, geometry: feature.geometry, properties: { name: feature.name, period: feature.period, source: feature.source, notes: feature.notes } })) };
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.intro}</p></div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.title, 'spatial-research') + '.geojson', collection)}>{t.export}</button></header>
    <section className="discipline-workspace__section"><div className="discipline-workspace__grid"><label>{t.project}<input value={workspace.title} onChange={e => setWorkspace(current => ({ ...current, title: e.target.value }))}/></label><label>{t.crs}<input value={workspace.crs} onChange={e => setWorkspace(current => ({ ...current, crs: e.target.value }))}/></label></div><p className="discipline-workspace__hint">{t.note}</p></section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.features} ({workspace.features.length})</h2><div><button type="button" onClick={() => setWorkspace(current => ({ ...current, features: [...current.features, makePoint()] }))}>{t.add}</button> <button type="button" onClick={() => fileRef.current?.click()}>{t.import}</button></div></div><input ref={fileRef} className="discipline-workspace__file-input" type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.currentTarget.value = ''; }}/>{error && <p role="alert">{error}</p>}{workspace.features.length === 0 && <p>{t.empty}</p>}
      {workspace.features.map(feature => <article className="discipline-workspace__card" key={feature.id}><div className="discipline-workspace__grid"><label>{t.name}<input value={feature.name} onChange={e => update(feature.id, { name: e.target.value })}/></label><label>{t.geometry}<input value={feature.geometry.type} readOnly/></label><label>{t.period}<input value={feature.period} onChange={e => update(feature.id, { period: e.target.value })}/></label><label>{t.source}<input value={feature.source} onChange={e => update(feature.id, { source: e.target.value })}/></label></div>{feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates) ? <><label>{t.longitude}<input type="number" step="any" value={String(feature.geometry.coordinates[0] ?? 0)} onChange={e => update(feature.id, { geometry: { ...feature.geometry, coordinates: [Number(e.target.value), Number(feature.geometry.coordinates[1] ?? 0)] } })}/></label><label>{t.latitude}<input type="number" step="any" value={String(feature.geometry.coordinates[1] ?? 0)} onChange={e => update(feature.id, { geometry: { ...feature.geometry, coordinates: [Number(feature.geometry.coordinates[0] ?? 0), Number(e.target.value)] } })}/></label></> : <label>{t.coordinates}<textarea rows={3} value={JSON.stringify(feature.geometry.coordinates)} readOnly/></label>}<label>{t.notes}<textarea rows={2} value={feature.notes} onChange={e => update(feature.id, { notes: e.target.value })}/></label><button className="discipline-workspace__danger" type="button" onClick={() => setWorkspace(current => ({ ...current, features: current.features.filter(item => item.id !== feature.id) }))}>{t.remove}</button></article>)}
    </section>
  </main>;
}
