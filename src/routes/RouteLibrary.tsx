import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, TextArea } from '../components/ui/Form';
import { RoutePreviewMap } from '../components/RoutePreviewMap';
import { useApp } from '../state/AppContext';
import { deleteSharedRoute, fetchSharedRoutes, resolveSharedRouteDownloadUrl, uploadSharedRoute } from '../lib/api';
import { parseGpxFile } from '../lib/gpx';
import type { SharedRoute } from '../types';
import './routelibrary.css';

// Plenty for any real GPX track (even a dense multi-day ultra file is
// usually well under 1 MB) — mainly a guard against picking the wrong
// file by accident.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
  const [file, setFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewRoute, setViewRoute] = useState<SharedRoute | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setRoutes(await fetchSharedRoutes());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the route library.');
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

  function openShare() {
    setTitle('');
    setDescription('');
    setCity('');
    setCountry('');
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
      const locationTag = [city.trim(), country.trim()].filter(Boolean).join(', ');
      const saved = await uploadSharedRoute(
        state.userId,
        uploaderName,
        { title: title.trim(), description: description.trim(), locationTag },
        gpxRoute,
        file,
      );
      setRoutes((prev) => [saved, ...prev]);
      setShareOpen(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Couldn't share that route — check it's a valid GPX file.");
    } finally {
      setSharing(false);
    }
  }

  async function openRoute(route: SharedRoute) {
    setViewRoute(route);
    setDownloadUrl(null);
    setViewError(null);
    const url = await resolveSharedRouteDownloadUrl(route.gpxFilePath);
    setDownloadUrl(url);
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
      setViewError(err instanceof Error ? err.message : 'Could not remove this route.');
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
        <div className="rg-rl-grid">
          {filtered.map((r) => (
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
              {r.uploaderName && <div className="text-muted rg-rl-card-uploader">Shared by {r.uploaderName}</div>}
            </button>
          ))}
        </div>
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
            <Field label="City / region">
              <Input type="text" value={city} placeholder="e.g. Annapurna region" onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <Input type="text" value={country} placeholder="e.g. Nepal" onChange={(e) => setCountry(e.target.value)} />
            </Field>
          </div>
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
          title={viewRoute.title}
          onDismiss={() => !deleting && setViewRoute(null)}
          actions={
            <>
              {viewRoute.uploaderUserId === state.userId && (
                <Button variant="ghost" disabled={deleting} onClick={handleDelete}>
                  {deleting ? 'Removing…' : 'Remove'}
                </Button>
              )}
              <span style={{ flex: 1 }} />
              {downloadUrl ? (
                <a className="btn btn-primary" href={downloadUrl} download={`${viewRoute.title}.gpx`}>
                  Download GPX
                </a>
              ) : (
                <Button variant="primary" disabled>
                  Preparing…
                </Button>
              )}
            </>
          }
        >
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
          {viewRoute.uploaderName && (
            <p className="text-muted" style={{ fontSize: 13 }}>
              Shared by {viewRoute.uploaderName}
            </p>
          )}
          {viewError && <div className="rg-auth-error">{viewError}</div>}
        </Dialog>
      )}
    </>
  );
}
