import { useRef, useState } from 'react';
import { inferTactic, toLocalDatetimeInput } from './event_manager';

// Capture user-entered incident data and emit a new event.
export function AddEventForm({ onAdd, onClear }) {
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [asset, setAsset] = useState('');
  const [host, setHost] = useState('');
  const [system, setSystem] = useState('');
  const [team, setTeam] = useState('');
  const [tactic, setTactic] = useState('');

  // Validate and normalize inputs before emitting the new event.
  const submit = (e) => {
    e.preventDefault();
    if (!time || !title || !asset) {
      alert('Time, Event Name, and Event Entity are required.');
      return;
    }
    const local = new Date(time);
    const utcIso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    onAdd({
      id: 'user-' + Date.now(),
      title,
      asset,
      host,
      category: system,
      team,
      tactic: tactic || inferTactic(title, ''), // seed with provided or inferred
      description: '',
      start: utcIso,
      end: null,
      severity: 'low',
    });
    setTime('');
    setTitle('');
    setAsset('');
    setHost('');
    setSystem('');
    setTeam('');
    setTactic('');
  };

  return (
    <section className="card">
      <h2>Add Event</h2>
      <form className="add-form" onSubmit={submit}>
        <label>
          Time (UTC)
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>
          Event Name
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Event Entity
          <input type="text" value={asset} onChange={(e) => setAsset(e.target.value)} />
        </label>
        <label>
          Event Host
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)} />
        </label>
        <label>
          Event System
          <input type="text" value={system} onChange={(e) => setSystem(e.target.value)} />
        </label>
        <label>
          Event Team
          <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} />
        </label>
        <label>
          MITRE Tactic
          <input type="text" value={tactic} onChange={(e) => setTactic(e.target.value)} placeholder="auto-infers if blank" />
        </label>
        <div className="actions">
          <button type="submit">Add</button>
          <button type="button" className="ghost" onClick={onClear}>
            Clear User Events
          </button>
        </div>
      </form>
    </section>
  );
}

// Editable table for user-supplied events with import/export.
export function EventsTable({ events, onChange, onDelete, onAddRow, onImport, onExport, severityOptions }) {
  const fileInput = useRef(null);

  // Load events from a JSON file and forward to the parent handler.
  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) throw new Error('JSON must be an array of events');
        onImport(imported);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
      if (fileInput.current) fileInput.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <section className="card">
      <div className="table-header">
        <h2>User Events</h2>
        <div className="actions">
          <button onClick={onAddRow}>Add Row</button>
          <button className="ghost" onClick={onExport}>
            Export JSON
          </button>
          <button className="ghost" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInput}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Event Name</th>
              <th>Event Entity</th>
              <th>Event Host</th>
              <th>Event System</th>
              <th>Event Team</th>
              <th>MITRE Tactic</th>
              <th>Severity</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>
                  <input
                    type="datetime-local"
                    value={toLocalDatetimeInput(ev.start)}
                    onChange={(e) => onChange(ev.id, 'start', e.target.value)}
                  />
                </td>
                <td>
                  <input type="text" value={ev.title || ''} onChange={(e) => onChange(ev.id, 'title', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={ev.asset || ''} onChange={(e) => onChange(ev.id, 'asset', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={ev.host || ''} onChange={(e) => onChange(ev.id, 'host', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={ev.category || ''} onChange={(e) => onChange(ev.id, 'category', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={ev.team || ''} onChange={(e) => onChange(ev.id, 'team', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={ev.tactic || ''} onChange={(e) => onChange(ev.id, 'tactic', e.target.value)} />
                </td>
                <td>
                  <select value={(ev.severity || 'low').toLowerCase()} onChange={(e) => onChange(ev.id, 'severity', e.target.value)}>
                    {severityOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="ghost" onClick={() => onDelete(ev.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No user events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
