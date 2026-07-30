import { Outlet } from 'react-router-dom';
import { AppNav } from './AppNav';
import { useApp } from '../../state/AppContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function AppLayout() {
  const { state, dispatch } = useApp();

  return (
    <div className="app-shell">
      <AppNav />
      <div className="app-main">
        <Outlet />
      </div>
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
