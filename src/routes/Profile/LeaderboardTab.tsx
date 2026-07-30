import { LEADERBOARD } from '../../data/constants';

export function LeaderboardTab() {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Runner</th>
          <th>Distance this week</th>
        </tr>
      </thead>
      <tbody>
        {LEADERBOARD.map((row) => (
          <tr key={row.rank} style={{ background: row.me ? 'var(--color-accent-100)' : 'transparent' }}>
            <td>#{row.rank}</td>
            <td>{row.name}</td>
            <td>{row.distance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
