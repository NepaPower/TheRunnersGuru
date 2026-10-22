import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { hasUnseenWhatsNew } from '../../data/whatsNew';
import '../../routes/privacy.css';
import { AppNav } from './AppNav';
import { FeedbackDialog } from '../FeedbackDialog';
import { useApp } from '../../state/AppContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function AppLayout() {
  const { state, dispatch } = useApp();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="app-shell">
      <AppNav onFeedback={() => setFeedbackOpen(true)} />
      <div className="app-main">
        <Outlet />
        <div className="app-feedback-footer rg-print-hide">
          Questions or ideas?{' '}
          <button type="button" className="app-feedback-link" onClick={() => setFeedbackOpen(true)}>
            Send feedback
          </button>
          {' · '}
          <Link to="/whats-new" className="app-feedback-link">
            What's new
            {hasUnseenWhatsNew() && <span className="rg-wn-dot" aria-label="new" />}
          </Link>
          {' · '}
          <Link to="/privacy" className="app-feedback-link">
            Privacy
          </Link>
          {' · '}
          <Link to="/terms" className="app-feedback-link">
            Terms
          </Link>
        </div>
      </div>
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      {state.sosOpen && (
        <Dialog
          title="Share live location?"
          onDismiss={() => dispatch({ type: 'SOS_CLOSE' })}
          actions={
            <>
              <Button variant="secondary" onClick={() => dispatch({ type: 'SOS_CLOSE' })}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => dispatch({ type: 'SOS_CONFIRM' })}>
                Share now
              </Button>
            </>
          }
        >
          Your run partner and two emergency contacts will get your live location and pace until you end this run.
        </Dialog>
      )}
    </div>
  );
}
