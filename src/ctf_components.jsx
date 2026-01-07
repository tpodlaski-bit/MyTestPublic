import { useMemo } from 'react';

// Render the CTF board with draggable event cards.
function CtfPane({ events, onMoveTeam }) {
  const { columns, orderMap, total } = useMemo(() => {
    const col = { red: [], blue: [], gray: [] };
    const sorted = events.slice().sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const nextOrderMap = new Map();
    sorted.forEach((ev, idx) => nextOrderMap.set(ev.id, idx + 1)); // 1-based row for grid
    sorted.forEach((ev) => {
      const team = (ev.team || '').toLowerCase();
      if (team.includes('red')) col.red.push(ev);
      else if (team.includes('blue')) col.blue.push(ev);
      else col.gray.push(ev);
    });
    return { columns: col, orderMap: nextOrderMap, total: sorted.length || 1 };
  }, [events]);

  // Format event timestamps for the cards.
  const formatTime = (d) => (d ? new Date(d).toLocaleString() : '');
  // Handle card drop to change the team column.
  const handleDrop = (ev, column) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    if (!id) return;
    onMoveTeam?.(id, column);
  };
  // Seed drag payload with the event id.
  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('text/plain', id);
    ev.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="ctf-grid">
      {['red', 'blue', 'gray'].map((key) => (
        <div
          key={key}
          className={`ctf-column ${key}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, key)}
        >
          <div className="ctf-header">{key.toUpperCase()}</div>
          <div className="ctf-stack" style={{ gridTemplateRows: `repeat(${total}, minmax(70px, auto))` }}>
            {columns[key].map((ev) => (
              <div
                key={ev.id}
                className="ctf-card"
                draggable
                onDragStart={(e) => handleDragStart(e, ev.id)}
                style={{ gridRow: orderMap.get(ev.id) || 'auto' }}
              >
                <div className="ctf-title">{ev.title || '(no title)'}</div>
                <div className="ctf-meta">
                  <span>{ev.asset || 'Unknown entity'}</span>
                  <span>{formatTime(ev.start)}</span>
                </div>
                {ev.description ? <div className="ctf-desc">{ev.description}</div> : null}
              </div>
            ))}
            {columns[key].length === 0 && <div className="ctf-empty">No events</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export { CtfPane };
