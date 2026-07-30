import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Form';
import { useApp } from '../state/AppContext';

export function Chat() {
  const { state, dispatch } = useApp();
  const contacts = state.matches.filter((m) => m.status === 'accepted');
  const activeContact = contacts.find((c) => c.id === state.activeChatId) || contacts[0];
  const thread = activeContact ? state.chatMessages[activeContact.id] || [] : [];

  function handleSend() {
    dispatch({ type: 'CHAT_SEND' });
  }

  return (
    <div className="chat-layout">
      <div style={{ border: '1px solid var(--color-divider)', overflowY: 'auto' }}>
        {contacts.map((c) => (
          <div
            key={c.id}
            className="chat-contact"
            style={{ background: c.id === activeContact?.id ? 'var(--color-accent-100)' : 'transparent' }}
            onClick={() => dispatch({ type: 'OPEN_CHAT_WITH', id: c.id })}
          >
            <div className="avatar-initials avatar-initials--sm">{c.initials}</div>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="text-muted" style={{ padding: 'var(--space-3)', fontSize: 13 }}>
            No matches yet.
          </p>
        )}
      </div>

      <div style={{ border: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
          {activeContact ? activeContact.name : 'No matches yet'}
        </div>

        <div className="chat-thread">
          {thread.map((m, i) => (
            <div
              key={i}
              className="chat-bubble"
              style={{
                alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                background: m.from === 'me' ? 'var(--color-accent-100)' : 'var(--color-neutral-100)',
              }}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="row-2" style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
          <Input
            placeholder={activeContact ? `Message ${activeContact.name}...` : 'Message...'}
            value={state.chatInput}
            onChange={(e) => dispatch({ type: 'CHAT_INPUT_CHANGE', value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!activeContact}
          />
          <Button variant="primary" onClick={handleSend} disabled={!activeContact}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
