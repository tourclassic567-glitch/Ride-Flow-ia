import React from 'react';

const ITEMS = [
  {
    title: 'Fix memory leak in WebSocket handler',
    secondary: 'expressjs/express',
    badge: 'JavaScript',
  },
  {
    title: 'Add dark mode to settings page',
    secondary: 'calcom/cal.com',
    badge: 'TypeScript',
  },
  {
    title: 'Improve CSV parser performance',
    secondary: 'pandas-dev/pandas',
    badge: 'Python',
  },
  {
    title: 'Update broken links in documentation',
    secondary: 'facebook/react',
    badge: 'Markdown',
  },
  {
    title: 'Add retry logic for failed API calls',
    secondary: 'psf/requests',
    badge: 'Python',
  },
];

const BADGE_COLORS = {
  JavaScript: { background: '#f7df1e', color: '#000' },
  TypeScript: { background: '#3178c6', color: '#fff' },
  Python: { background: '#3572A5', color: '#fff' },
  Markdown: { background: '#083fa1', color: '#fff' },
};

function OpenSourceFeed() {
  return (
    <div className="card">
      <h3 className="card-title">🛠️ Open Source Issues</h3>
      <ul className="issue-list">
        {ITEMS.map((item, index) => {
          const colors = BADGE_COLORS[item.badge] || { background: '#6c757d', color: '#fff' };
          return (
            <li key={index} className="issue-item">
              <div className="issue-item-content">
                <span className="issue-title">{item.title}</span>
                <span className="issue-secondary">{item.secondary}</span>
              </div>
              <span
                className="issue-badge"
                style={{ background: colors.background, color: colors.color }}
              >
                {item.badge}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default OpenSourceFeed;
