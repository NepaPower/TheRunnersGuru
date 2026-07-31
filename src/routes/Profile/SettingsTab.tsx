import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import { GARMIN_SAMPLE_ACTIVITIES } from '../../data/constants';
import { saveProfileAddress, setGarminConnected } from '../../lib/api';

export function SettingsTab() {
  const { state, dispatch } = useApp();
  const address = state.auth.address;
  const zipMissing = address.zip.trim() === '';
  const [savingAddress, setSavingAddress] = useState(false);
  const [garminBusy, setGarminBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (field: keyof typeof address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    dispatch({ type: 'ADDRESS_FIELD_CHANGE', field, value: e.target.value });

  async function handleSaveAddress() {
    if (!state.userId) return;
    setError(null);
    setSavingAddress(true);
    try {
      await saveProfileAddress(state.userId, state.auth.name, address);
      dispatch({ type: 'ADDRESS_SAVED' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleToggleGarmin(connect: boolean) {
    if (!state.userId) return;
    setError(null);
    setGarminBusy(true);
    try {
      await setGarminConnected(state.userId, connect);
      dispatch({ type: connect ? 'GARMIN_CONNECT' : 'GARMIN_DISCONNECT' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update Garmin connection.');
    } finally {
      setGarminBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div style={{ border: '1px solid var(--color-accent-2-600)', background: 'var(--color-accent-2-100)', padding: 'var(--space-3)', borderRadius: 10, marginBottom: 'var(--space-4)', fontSize: 13.5, maxWidth: 520 }}>
          {error}
        </div>
      )}

      <div className="rg-card stack-3" style={{ maxWidth: 520, marginBottom: 'var(--space-6)' }}>
        <div className="row-3">
          <div className="rg-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
              Connected devices
            </div>
            <h3 style={{ margin: 0 }}>Garmin Connect</h3>
          </div>
        </div>

        {state.garminConnected ? (
          <>
            <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
              Connected — syncing runs, pace and heart rate automatically.
            </p>
            <div className="stack-2">
              {GARMIN_SAMPLE_ACTIVITIES.map((a) => (
                <div
                  key={a.date + a.title}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}
                >
                  <span>
                    {a.date} · {a.title}
                  </span>
                  <span className="text-muted">
                    {a.distance} · {a.pace} · {a.hr}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="secondary" disabled={garminBusy} onClick={() => handleToggleGarmin(false)}>
              {garminBusy ? 'Working…' : 'Disconnect'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
              Sync your watch to auto-import runs, pace, distance and heart rate into your training plan.
            </p>
            <Button variant="primary" disabled={garminBusy} onClick={() => handleToggleGarmin(true)}>
              {garminBusy ? 'Working…' : 'Connect Garmin →'}
            </Button>
          </>
        )}
      </div>

      <div className="rg-card" style={{ maxWidth: 520 }}>
        <div className="row-3" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="rg-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <circle cx="12" cy="8" r="4" strokeWidth="2" />
              <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Your profile</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
              Your name and address — used to find races and running partners near you.
            </p>
          </div>
        </div>

        <Field label="Name" style={{ marginBottom: 'var(--space-4)' }}>
          <Input
            type="text"
            placeholder="Your name"
            value={state.auth.name}
            onChange={(e) => dispatch({ type: 'AUTH_NAME_CHANGE', value: e.target.value })}
          />
        </Field>

        <Field label="Street address" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="123 Main St" value={address.street} onChange={setField('street')} />
        </Field>
        <Field label="Apt / Suite" optional style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="Apt 4B" value={address.unit} onChange={setField('unit')} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Field label="City">
            <Input type="text" placeholder="Austin" value={address.city} onChange={setField('city')} />
          </Field>
          <Field label="State">
            <Input type="text" placeholder="TX" value={address.state} onChange={setField('state')} />
          </Field>
          <Field label="Zip" required>
            <Input type="text" placeholder="78701" value={address.zip} onChange={setField('zip')} />
          </Field>
        </div>

        <Field label="Phone number" optional style={{ marginBottom: 'var(--space-6)' }}>
          <Input type="tel" placeholder="(555) 555-0100" value={address.phone} onChange={setField('phone')} />
        </Field>

        <div className="row-3">
          <Button variant="primary" disabled={zipMissing || savingAddress} onClick={handleSaveAddress}>
            {savingAddress ? 'Saving…' : 'Save profile'}
          </Button>
          {state.addressSaved && !savingAddress && (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Saved ✓
            </span>
          )}
        </div>
      </div>
    </>
  );
}
