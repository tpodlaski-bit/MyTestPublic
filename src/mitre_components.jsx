import { useEffect, useState } from 'react';

const MITRE_TACTICS = [
  { id: 'TA0043', label: 'Reconnaissance' },
  { id: 'TA0042', label: 'Resource Development' },
  { id: 'TA0001', label: 'Initial Access' },
  { id: 'TA0002', label: 'Execution' },
  { id: 'TA0003', label: 'Persistence' },
  { id: 'TA0004', label: 'Privilege Escalation' },
  { id: 'TA0005', label: 'Defense Evasion' },
  { id: 'TA0006', label: 'Credential Access' },
  { id: 'TA0007', label: 'Discovery' },
  { id: 'TA0008', label: 'Lateral Movement' },
  { id: 'TA0009', label: 'Collection' },
  { id: 'TA0011', label: 'Command and Control' },
  { id: 'TA0010', label: 'Exfiltration' },
  { id: 'TA0040', label: 'Impact' },
  { id: 'UNKNOWN', label: 'Unknown' },
];

const normalizeTactic = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/ta\d{4}/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

function MitrePane({ events = [], onMoveTactic }) {
  const [showEmpty, setShowEmpty] = useState(true);
  const [showUnknown, setShowUnknown] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('mitre_show_empty_tactics');
    if (stored === 'false') setShowEmpty(false);
  }, []);
  useEffect(() => {
    localStorage.setItem('mitre_show_empty_tactics', String(showEmpty));
  }, [showEmpty]);
  useEffect(() => {
    const stored = localStorage.getItem('mitre_show_unknown');
    if (stored === 'false') setShowUnknown(false);
  }, []);
  useEffect(() => {
    localStorage.setItem('mitre_show_unknown', String(showUnknown));
  }, [showUnknown]);
  const tacticMap = new Map(
    MITRE_TACTICS.map((tactic) => [
      `${normalizeTactic(tactic.id)}-${normalizeTactic(tactic.label)}`,
      [],
    ]),
  );
  events.forEach((ev) => {
    const raw = String(ev?.tactic || '');
    const norm = normalizeTactic(raw);
    if (!norm) {
      const unknownKey = `${normalizeTactic('UNKNOWN')}-${normalizeTactic('Unknown')}`;
      tacticMap.get(unknownKey)?.push(ev);
      return;
    }
    const matched = MITRE_TACTICS.find((t) => {
      const idMatch = normalizeTactic(t.id) === norm;
      const labelMatch = normalizeTactic(t.label) === norm;
      const combinedMatch = normalizeTactic(`${t.id} ${t.label}`) === norm;
      return idMatch || labelMatch || combinedMatch;
    });
    if (!matched) {
      const unknownKey = `${normalizeTactic('UNKNOWN')}-${normalizeTactic('Unknown')}`;
      tacticMap.get(unknownKey)?.push(ev);
      return;
    }
    const mapKey = `${normalizeTactic(matched.id)}-${normalizeTactic(matched.label)}`;
    tacticMap.get(mapKey).push(ev);
  });

  const formatTime = (d) => (d ? new Date(d).toLocaleString() : '');
  const teamClass = (team = '') => {
    const value = team.toLowerCase();
    if (value.includes('red')) return 'red';
    if (value.includes('blue')) return 'blue';
    return 'gray';
  };
  const teamStyle = (team) => {
    const palette = {
      red: {
        '--mitre-card-bg': 'rgba(252, 165, 165, 0.18)',
        '--mitre-card-border': 'rgba(255, 255, 255, 0.4)',
        '--mitre-card-text': '#fff',
        '--mitre-card-meta': '#fef2f2',
      },
      blue: {
        '--mitre-card-bg': 'rgba(59, 130, 246, 0.26)',
        '--mitre-card-border': 'rgba(255, 255, 255, 0.4)',
        '--mitre-card-text': '#fff',
        '--mitre-card-meta': '#f8fafc',
      },
      gray: {
        '--mitre-card-bg': 'rgba(255, 255, 255, 0.04)',
        '--mitre-card-text': '#fff',
        '--mitre-card-meta': '#e2e8f0',
      },
    };
    const key = teamClass(team);
    return palette[key];
  };
  const handleDrop = (ev, tactic) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    if (!id) return;
    onMoveTactic?.(id, tactic);
  };
  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('text/plain', id);
    ev.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="mitre-view">
      <div className="mitre-controls">
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(e) => setShowEmpty(e.target.checked)}
          />
          Show empty tactics
        </label>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={showUnknown}
            onChange={(e) => setShowUnknown(e.target.checked)}
          />
          Show unknown
        </label>
      </div>
      <div className="mitre-grid">
        {MITRE_TACTICS.map((tactic) => {
        if (!showUnknown && tactic.id === 'UNKNOWN') return null;
        const mapKey = `${normalizeTactic(tactic.id)}-${normalizeTactic(tactic.label)}`;
        const items = tacticMap.get(mapKey) || [];
        if (!showEmpty && items.length === 0) return null;
        return (
          <section
            key={tactic.id}
            className="mitre-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, tactic)}
          >
          <div className="mitre-header">
            <span>{tactic.label}</span>
            <span className="mitre-id">{tactic.id}</span>
          </div>
          <div className="mitre-stack">
            {items.map((ev) => (
              <div
                key={ev.id}
                className={`mitre-card ${teamClass(ev.team)}`}
                style={teamStyle(ev.team)}
                draggable
                onDragStart={(e) => handleDragStart(e, ev.id)}
              >
                <div className="mitre-title">{ev.title || '(no title)'}</div>
                <div className="mitre-meta">
                  <span>{ev.asset || 'Unknown entity'}</span>
                  <span>{formatTime(ev.start)}</span>
                </div>
                {ev.description ? <div className="mitre-desc">{ev.description}</div> : null}
              </div>
            ))}
            {items.length === 0 && <div className="mitre-empty">No events</div>}
          </div>
        </section>
        );
        })}
      </div>
    </div>
  );
}

export { MitrePane };
