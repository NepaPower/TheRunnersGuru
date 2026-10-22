import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Input } from './ui/Form';
import { useApp } from '../state/AppContext';
import { deleteMyAccount, fetchAccountSummary } from '../lib/api';
import { cacheClearAll } from '../lib/offlineCache';

const CONFIRM_WORD = 'DELETE';

/** The last step of "Delete my account": says exactly what will go (with real
 * counts), and only enables the button once DELETE has been typed. Irreversible. */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [crewMembers, setCrewMembers] = useState<number | null>(null);
  const [sharedRoutes, setSharedRoutes] = useState<number | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = state.userId;
  const ownPlanIds = state.ownPlans.map((p) => p.id).filter((id): id is string => !!id);

  useEffect(() => {
    if (!userId) return;
    fetchAccountSummary(userId)
      .then((s) => {
        setCrewMembers(s.crewMembers);
        setSharedRoutes(s.sharedRoutes);
      })
      .catch(() => setSummaryFailed(true));
  }, [userId]);

  async function handleDelete() {
    if (!userId || typed.trim().toUpperCase() !== CONFIRM_WORD) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteMyAccount(userId, ownPlanIds);
      await cacheClearAll();
      dispatch({ type: 'LOGOUT' });
      navigate('/', { replace: true, state: { accountDeleted: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the account. Nothing was deleted. Please try again.');
      setDeleting(false);
    }
  }

  const races = state.ownPlans.length;
  const runs = state.loggedRuns.length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <Dialog
      title="Delete your account?"
      onDismiss={deleting ? undefined : onClose}
      actions={
        <>
          <Button variant="secondary" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={deleting || typed.trim().toUpperCase() !== CONFIRM_WORD}
            onClick={handleDelete}
            style={{ background: '#a3362f', borderColor: '#a3362f' }}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        This permanently deletes <strong>{state.auth.email}</strong> and everything attached to it. It can't be undone.
      </p>
      <ul style={{ margin: '0 0 var(--space-3)', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Your profile, name and address</li>
        <li>
          {plural(runs, 'logged run', 'logged runs')}
        </li>
        <li>
          {plural(races, 'race', 'races')}, with their training plans and Crew Plans (aid stations, notes, GPX files and
          images)
        </li>
        <li>
          {sharedRoutes == null ? 'Routes you shared to the Route Library' : plural(sharedRoutes, 'route you shared', 'routes you shared') + ' to the Route Library'}
        </li>
        <li>Your place on plans other people shared with you</li>
      </ul>
      {crewMembers != null && crewMembers > 0 && (
        <p style={{ margin: '0 0 var(--space-3)', color: '#a3362f', fontWeight: 600 }}>
          {plural(crewMembers, 'person', 'people')} you invited as crew will lose access to your plans.
        </p>
      )}
      {summaryFailed && (
        <p className="text-muted" style={{ fontSize: 13, margin: '0 0 var(--space-3)' }}>
          We couldn't count your crew and shared routes just now. Everything above is still deleted.
        </p>
      )}
      <Field label={`Type ${CONFIRM_WORD} to confirm`}>
        <Input
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          value={typed}
          disabled={deleting}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleDelete();
          }}
        />
      </Field>
      {error && (
        <div className="rg-auth-error" style={{ marginTop: 'var(--space-3)' }}>
          {error}
        </div>
      )}
    </Dialog>
  );
}
