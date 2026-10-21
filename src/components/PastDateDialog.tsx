import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

/** Pop-up shown when someone tries to save a race whose date has already
 * passed. "Change date" just closes it so they can fix the field. */
export function PastDateDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="That race date has passed"
      onDismiss={onClose}
      actions={
        <Button variant="primary" onClick={onClose}>
          Change date
        </Button>
      }
    >
      <p>That date has already passed. Enter your race date — today or later.</p>
    </Dialog>
  );
}
