import { Blueprint } from '../components/ui/Blueprint';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';
import { runElapsedLabel, runPaceLabel } from '../state/selectors';

export function Run() {
  const { state, dispatch } = useApp();
  const { run } = state;
  const activePartner = state.matches.find((m) => m.id === state.activeChatId && m.status === 'accepted');

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>Run</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        {run.active ? 'Live — tracking your route and pace.' : 'Start a run to begin live tracking.'}
      </p>

      <div className="rg-grid-main-side">
        <Blueprint className="live-map-placeholder">
          <span className="live-map-label">LIVE MAP — GPS FEED PLACEHOLDER</span>
        </Blueprint>

        <div className="stack-4">
          <Blueprint className="blueprint-card rg-grid-2" style={{ border: '1px solid var(--color-divider)' }}>
            <div>
              <div className="card-kicker">Time</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 600 }}>
                {runElapsedLabel(run.elapsedSeconds)}
              </div>
            </div>
            <div>
              <div className="card-kicker">Distance</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 600 }}>
                {run.distanceMiles.toFixed(2)} mi
              </div>
            </div>
            <div>
              <div className="card-kicker">Pace</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 600 }}>
                {runPaceLabel(run.elapsedSeconds, run.distanceMiles)}
              </div>
            </div>
            <div>
              <div className="card-kicker">Partner</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, marginTop: 6 }}>
                {activePartner ? activePartner.name : 'Solo run'}
              </div>
            </div>
          </Blueprint>

          <Button variant={run.active ? 'secondary' : 'primary'} block onClick={() => dispatch({ type: 'RUN_TOGGLE' })}>
            {run.active ? 'End run' : 'Start run'}
          </Button>
          <Button variant="secondary" block onClick={() => dispatch({ type: 'SOS_OPEN' })}>
            Share live location · SOS
          </Button>
        </div>
      </div>
    </>
  );
}
