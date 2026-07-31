import { useState } from 'react';
import { Blueprint } from '../../components/ui/Blueprint';
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
      setError(e instanceof Error ? e.message : 'Could not save your address.');
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
        <div style={{ border: '1px solid var(--color-accent-2-600)', background: 'var(--color-accent-2-100)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: 13, maxWidth: 520 }}>
          {error}
        </div>
      )}

      <Blueprint className="blueprint-card" style={{ border: '1px solid var(--color-divider)', maxWidth: 520, marginBottom: 'var(--space-6)' }}>
        <div className="card-kicker">Connected devices</div>
        <h3 style={{ margin: 'var(--space-1) 0 var(--space-2)' }}>Garmin Connect</h3>

        {state.garminConnected ? (
          <>
            <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
              Connected — syncing runs, pace and heart rate automatically.
            </p>
            <div className="stack-2" style={{ marginBottom: 'var(--space-4)' }}>
              {GARMIN_SAMPLE_ACTIVITIES.map((a) => (
                <div
                  key={a.date + a.title}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}
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
            <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
              Sync your watch to auto-import runs, pace, distance and heart rate into your training plan.
            </p>
            <Button variant="primary" disabled={garminBusy} onClick={() => handleToggleGarmin(true)}>
              {garminBusy ? 'Working…' : 'Connect Garmin →'}
            </Button>
          </>
        )}
      </Blueprint>

      <Blueprint className="blueprint-card" style={{ border: '1px solid var(--color-divider)', maxWidth: 520 }}>
        <h3 style={{ marginBottom: 'var(--space-1)' }}>Your address</h3>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Used to find races and running partners near you.
        </p>

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
            {savingAddress ? 'Saving…' : 'Save address'}
          </Button>
          {state.addressSaved && !savingAddress && (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Saved ✓
            </span>
          )}
        </div>
      </Blueprint>
    </>
  );
}
