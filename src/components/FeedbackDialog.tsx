import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Select, TextArea } from './ui/Form';
import { useApp } from '../state/AppContext';
import { submitFeedback } from '../lib/api';
import type { FeedbackCategory } from '../types';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'idea', label: 'An idea or suggestion' },
  { value: 'bug', label: "Something's broken or confusing" },
  { value: 'question', label: 'A question' },
  { value: 'other', label: 'Something else' },
];

/** In-app "Send feedback" — writes a row to the write-only `feedback`
 * table. Records which page the person was on, since "this is confusing"
 * is much more useful with the screen attached. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { state } = useApp();
  const { pathname } = useLocation();
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!state.userId) return;
    if (!message.trim()) {
      setError('Tell us a little about what you have in mind.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await submitFeedback(state.userId, {
        category,
        message: message.trim(),
        page: pathname,
        email: state.auth.email || null,
        name: state.auth.name || null,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Dialog
        title="Thank you!"
        onDismiss={onClose}
        actions={
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p>Your feedback went straight to the team. We read every note.</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Send feedback"
      onDismiss={() => !sending && onClose()}
      actions={
        <>
          <Button variant="secondary" disabled={sending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={sending} onClick={handleSend}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </>
      }
    >
      <Field label="What kind of feedback?" style={{ marginBottom: 'var(--space-3)' }}>
        <Select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Your feedback" style={{ marginBottom: 'var(--space-3)' }}>
        <TextArea
          rows={6}
          maxLength={4000}
          value={message}
          placeholder="What were you trying to do? What got in the way, or what would make this better?"
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      {error && <div className="rg-auth-error">{error}</div>}
    </Dialog>
  );
}
