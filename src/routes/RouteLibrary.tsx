import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, TextArea } from '../components/ui/Form';
import { RoutePreviewMap } from '../components/RoutePreviewMap';
import { useApp } from '../state/AppContext';
import {
  deleteSharedRoute,
  fetchSharedRoutes,
  resolveSharedRouteDownloadUrl,
  updateSharedRoute,
  uploadSharedRoute,
} from '../lib/api';
import { parseGpxFile } from '../lib/gpx';
import { COUNTRIES, US_STATES } from '../data/constants';
import type { SharedRoute } from '../types';
import './routelibrary.css';

// Plenty for any real GPX track (even a dense multi-day ultra file is
// usually well under 1 MB) — mainly a guard against picking the wrong
// file by accident.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// locationTag is stored as "City, State/region, Country" (see
// handleShare below) — there's no separate country column, so grouping
// just reads the last comma-separated segment. A route shared before
// the Country dropdown existed, or with no location at all, falls into
// "Other" rather than breaking the grouping.
function countryOf(route: SharedRoute): string {
  const parts = route.locationTag
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : 'Other';
}

// Supabase/PostgREST errors (RLS denials, constraint violations, etc.) carry
// the real cause in `.message`, but aren't always `instanceof Error` once
// they've crossed an async boundary — checking only `instanceof Error` was
// silently swallowing those and showing a generic, sometimes misleading,
// fallback instead (e.g. blaming "a valid GPX file" for what was actually a
// database error). Logging the raw error too so the full detail/hint/code
// is available in devtools even when the UI only has room for `message`.
function describeError(err: unknown, fallback: string): string {
  console.error(err);
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/** "Local Trails, Global Guru." — a standalone place to share and
 * discover GPX routes, deliberately separate from any race's own course
 * file (onboarding / Crew Plan's GPX upload). Sign-in required to browse
 * or share; any signed-in user can do both; only a route's own uploader
 * can remove it (DB-enforced via RLS, not just a hidden button). */
export function RouteLibrary() {
  const { state } = useApp();
  const [routes, setRoutes] = useState<SharedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [shareOpen, setShareOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [stateOrRegion, setStateOrRegion] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewRoute, setViewRoute] = useState<SharedRoute | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editReferenceUrl, setEditReferenceUrl] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setRoutes(await fetchSharedRoutes());
    } catch (err) {
      setLoadError(describeError(err, 'Could not load the route library.'));
    } finally {
      setLoading(false);
    }
  }

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? routes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.locationTag.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      )
    : routes;

  // Group by country (derived from locationTag — see countryOf above),
  // alphabetical, with "Other" always last regardless of where it'd
  // otherwise sort.
  const groupedByCountry: [string, SharedRoute[]][] = (() => {
    const groups = new Map<string, SharedRoute[]>();
    for (const r of filtered) {
      const key = countryOf(r);
      const existing = groups.get(key);
      if (existing) existing.push(r);
      else groups.set(key, [r]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  })();

  function openShare() {
    setTitle('');
    setDescription('');
    setCity('');
    setCountry('');
    setStateOrRegion('');
    setReferenceUrl('');
    setFile(null);
    setShareError(null);
    setShareOpen(true);
  }

  async function handleShare() {
    if (!state.userId) return;
    if (!title.trim()) {
      setShareError('Give the route a title.');
      return;
    }
    if (!file) {
      setShareError('Pick a GPX file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setShareError('That file is too large (10 MB max).');
      return;
    }
    setShareError(null);
    setSharing(true);
    try {
      const gpxRoute = await parseGpxFile(file, { includeTrackPreview: true });
      const uploaderName = state.auth.name || state.auth.email || 'A runner';
      const locationTag = [city.trim(), stateOrRegion.trim(), country.trim()].filter(Boolean).join(', ');
      const saved = await uploadSharedRoute(
        state.userId,
        uploaderName,
        { title: title.trim(), description: description.trim(), locationTag, referenceUrl: referenceUrl.trim() },
        gpxRoute,
        file,
      );
      setRoutes((prev) => [saved, ...prev]);
      setShareOpen(false);
    } catch (err) {
      setShareError(describeError(err, "Couldn't share that route — check it's a valid GPX file."));
    } finally {
      setSharing(false);
    }
  }

  async function openRoute(route: SharedRoute) {
    setViewRoute(route);
    setDownloadUrl(null);
    setViewError(null);
    setEditing(false);
    const url = await resolveSharedRouteDownloadUrl(route.gpxFilePath);
    setDownloadUrl(url);
  }

  function openEdit() {
    if (!viewRoute) return;
    setEditDescription(viewRoute.description);
    setEditReferenceUrl(viewRoute.referenceUrl ?? '');
    setEditFile(null);
    setEditError(null);
    setEditing(true);
  }

  async function handleEditSave() {
    if (!viewRoute || !state.userId) return;
    if (editFile && editFile.size > MAX_FILE_BYTES) {
      setEditError('That file is too large (10 MB max).');
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const replacement = editFile
        ? { gpxRoute: await parseGpxFile(editFile, { includeTrackPreview: true }), file: editFile }
        : undefined;
      const updated = await updateSharedRoute(
        viewRoute.id,
        viewRoute.gpxFilePath,
        state.userId,
        { description: editDescription.trim(), referenceUrl: editReferenceUrl.trim() },
        replacement,
      );
      setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setViewRoute(updated);
      if (replacement) {
        setDownloadUrl(null);
        setDownloadUrl(await resolveSharedRouteDownloadUrl(updated.gpxFilePath));
      }
      setEditing(false);
    } catch (err) {
      setEditError(describeError(err, 'Could not save changes.'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!viewRoute) return;
    setDeleting(true);
    setViewError(null);
    try {
      await deleteSharedRoute(viewRoute.id, viewRoute.gpxFilePath);
      setRoutes((prev) => prev.filter((r) => r.id !== viewRoute.id));
      setViewRoute(null);
    } catch (err) {
      setViewError(describeError(err, 'Could not remove this route.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="rg-rl-header">
        <div>
          <h2 style={{ marginBottom: 0 }}>Route Library</h2>
          <p className="text-muted rg-rl-tagline">Local Trails, Global Guru.</p>
        </div>
        <Button variant="primary" onClick={openShare}>
          + Share a route
        </Button>
      </div>

      <Field label="Search by title, description, or location" style={{ marginBottom: 'var(--space-6)' }}>
        <Input
          type="text"
          placeholder="e.g. Nepal, Annapurna, ridge…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Field>

      {loadError && (
        <div className="rg-auth-error" style={{ marginBottom: 'var(--space-4)' }}>
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted">
          {routes.length === 0 ? 'No routes shared yet — be the first.' : 'No routes match that search.'}
        </p>
      ) : (
        groupedByCountry.map(([country, countryRoutes]) => (
          <div key={country} className="rg-rl-country-group">
            <h3 className="rg-rl-country-heading">{country}</h3>
            <div className="rg-rl-grid">
              {countryRoutes.map((r) => (
                <button key={r.id} type="button" className="rg-rl-card" onClick={() => openRoute(r)}>
                  {r.gpxRoute.trackPoints && (
                    <div className="rg-rl-card-map">
                      <RoutePreviewMap trackPoints={r.gpxRoute.trackPoints} height={110} />
                    </div>
                  )}
                  <div className="rg-rl-card-title">{r.title}</div>
                  {r.locationTag && <div className="rg-rl-card-location">{r.locationTag}</div>}
                  <div className="rg-rl-card-stats">
                    {r.gpxRoute.distanceMiles} mi · +{r.gpxRoute.elevationGainFt.toLocaleString()} ft
                  </div>
                  {r.uploaderName && (
                    <div className="text-muted rg-rl-card-uploader">Shared by {r.uploaderName}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {shareOpen && (
        <Dialog
          title="Share a route"
          onDismiss={() => !sharing && setShareOpen(false)}
          actions={
            <>
              <Button variant="secondary" disabled={sharing} onClick={() => setShareOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={sharing} onClick={handleShare}>
                {sharing ? 'Sharing…' : 'Share'}
              </Button>
            </>
          }
        >
          <Field label="Title" style={{ marginBottom: 'var(--space-3)' }}>
            <Input
              type="text"
              value={title}
              placeholder="e.g. Poon Hill Ridge Loop"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="rg-rl-location-fields">
            <Field label="City">
              <Input type="text" value={city} placeholder="e.g. Moab" onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <Select value={country} onChange={(e) => { setCountry(e.target.value); setStateOrRegion(''); }}>
                <option value="">— Select —</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            {country === 'United States' ? (
              <Field label="State">
                <Select value={stateOrRegion} onChange={(e) => setStateOrRegion(e.target.value)}>
                  <option value="">— Select —</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="State / region" optional>
                <Input
                  type="text"
                  value={stateOrRegion}
                  placeholder="e.g. Annapurna region"
                  onChange={(e) => setStateOrRegion(e.target.value)}
                />
              </Field>
            )}
          </div>
          <Field label="Reference URL" optional style={{ marginBottom: 'var(--space-3)' }}>
            <Input
              type="text"
              value={referenceUrl}
              placeholder="e.g. a park/land-manager page or the race's course page"
              onChange={(e) => setReferenceUrl(e.target.value)}
            />
          </Field>
          <Field label="Description" optional style={{ marginBottom: 'var(--space-3)' }}>
            <TextArea
              rows={4}
              value={description}
              placeholder="Terrain, best season, water sources — anything the next runner should know…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="GPX file" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="rg-rl-file-picker">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {file ? 'Change file' : 'Choose file'}
              </Button>
              {file && <span className="text-muted" style={{ fontSize: 13 }}>{file.name}</span>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          {shareError && <div className="rg-auth-error">{shareError}</div>}
        </Dialog>
      )}

      {viewRoute && (
        <Dialog
          title={editing ? `Edit ${viewRoute.title}` : viewRoute.title}
          onDismiss={() => {
            if (deleting || editSaving) return;
            if (editing) setEditing(false);
            else setViewRoute(null);
          }}
          actions={
            editing ? (
              <>
                <Button variant="secondary" disabled={editSaving} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={editSaving} onClick={handleEditSave}>
                  {editSaving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                {viewRoute.uploaderUserId === state.userId && (
                  <>
                    <Button variant="ghost" disabled={deleting} onClick={handleDelete}>
                      {deleting ? 'Removing…' : 'Remove'}
                    </Button>
                    <Button variant="secondary" disabled={deleting} onClick={openEdit}>
                      Edit
                    </Button>
                  </>
                )}
                <span style={{ flex: 1 }} />
                {downloadUrl ? (
                  <a
                    className="btn btn-primary"
                    href={downloadUrl}
                    download={viewRoute.gpxRoute.fileName || `${viewRoute.title}.gpx`}
                  >
                    Download GPX
                  </a>
                ) : (
                  <Button variant="primary" disabled>
                    Preparing…
                  </Button>
                )}
              </>
            )
          }
        >
          {editing ? (
            <>
              <Field label="Reference URL" optional style={{ marginBottom: 'var(--space-3)' }}>
                <Input
                  type="text"
                  value={editReferenceUrl}
                  placeholder="e.g. a park/land-manager page or the race's course page"
                  onChange={(e) => setEditReferenceUrl(e.target.value)}
                />
              </Field>
              <Field label="Description" optional style={{ marginBottom: 'var(--space-3)' }}>
                <TextArea
                  rows={4}
                  value={editDescription}
                  placeholder="Terrain, best season, water sources — anything the next runner should know…"
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </Field>
              <Field label="GPX file" optional style={{ marginBottom: 'var(--space-3)' }}>
                <div className="rg-rl-file-picker">
                  <Button variant="secondary" onClick={() => editFileInputRef.current?.click()}>
                    {editFile ? 'Change file' : 'Replace file'}
                  </Button>
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    {editFile ? editFile.name : viewRoute.gpxRoute.fileName}
                  </span>
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".gpx"
                  style={{ display: 'none' }}
                  onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              {editError && <div className="rg-auth-error">{editError}</div>}
            </>
          ) : (
            <>
              {viewRoute.gpxRoute.trackPoints && (
                <div className="rg-rl-detail-map">
                  <RoutePreviewMap trackPoints={viewRoute.gpxRoute.trackPoints} height={220} />
                </div>
              )}
              {viewRoute.locationTag && (
                <p className="text-muted" style={{ marginBottom: 'var(--space-2)' }}>
                  {viewRoute.locationTag}
                </p>
              )}
              <p style={{ marginBottom: 'var(--space-3)' }}>
                {viewRoute.gpxRoute.distanceMiles} mi · +{viewRoute.gpxRoute.elevationGainFt.toLocaleString()} ft / −
                {viewRoute.gpxRoute.elevationLossFt.toLocaleString()} ft
              </p>
              {viewRoute.description && <p style={{ marginBottom: 'var(--space-3)' }}>{viewRoute.description}</p>}
              {viewRoute.referenceUrl && (
                <p style={{ marginBottom: 'var(--space-3)' }}>
                  <a href={viewRoute.referenceUrl} target="_blank" rel="noreferrer noopener">
                    Official source / more info ↗
                  </a>
                </p>
              )}
              {viewRoute.uploaderName && (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Shared by {viewRoute.uploaderName}
                </p>
              )}
              {viewError && <div className="rg-auth-error">{viewError}</div>}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
