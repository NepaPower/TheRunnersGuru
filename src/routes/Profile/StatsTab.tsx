import { PROFILE_LIFETIME_STATS, RUN_HISTORY } from '../../data/constants';

export function StatsTab() {
  return (
    <>
      <div className="grid-auto-160" style={{ marginBottom: 'var(--space-6)' }}>
        {PROFILE_LIFETIME_STATS.map((stat) => (
          <div key={stat.label} className="card">
            <div className="card-kicker">{stat.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600, marginTop: 'var(--space-1)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: 'var(--space-3)' }}>Run history</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Distance</th>
            <th>Pace</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {RUN_HISTORY.map((r) => (
            <tr key={r.date}>
              <td>{r.date}</td>
              <td>{r.distance}</td>
              <td>{r.pace}</td>
              <td>{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
