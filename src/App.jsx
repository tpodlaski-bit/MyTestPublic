import { useEffect, useMemo, useState } from 'react';
import {
  addRow as addRowHelper,
  addUserEvent as addUserEventHelper,
  clearUserEvents as clearUserEventsHelper,
  deleteUserEvent as deleteUserEventHelper,
  exportEvents as exportEventsHelper,
  importEvents as importEventsHelper,
  saveUserIncidents,
  updateUserEvent as updateUserEventHelper,
  useIncidents,
} from './event_manager';
import { AddEventForm, EventsTable } from './event_components';
import { ReportsPane, makeAnalyzeHandler, makeDeleteReportHandler } from './reports_components';
import { Timeline } from './timeline_components';
import { CtfPane } from './ctf_components';
import { MitrePane } from './mitre_components';
import { EVENT_ANALYSIS_PROMPTS } from './prompts';
import './App.css';
const severityOptions = ['critical', 'high', 'medium', 'low'];

const badgeFieldOptions = [
  { value: 'title', label: 'Event Name' },
  { value: 'asset', label: 'Event Entity' },
  { value: 'host', label: 'Event Host' },
  { value: 'description', label: 'Event Description' },
  { value: 'category', label: 'Event System' },
  { value: 'team', label: 'Event Team' },
  { value: 'tactic', label: 'MITRE Tactic' },
  { value: 'severity', label: 'Severity' },
  { value: 'time', label: 'Time (UTC)' },
];

const groupFieldOptions = [
  { value: 'asset', label: 'Event Entity' },
  { value: 'severity', label: 'Severity' },
  { value: 'host', label: 'Event Host' },
  { value: 'category', label: 'Event System' },
  { value: 'team', label: 'Event Team' },
  { value: 'tactic', label: 'MITRE Tactic' },
  { value: 'title', label: 'Event Name' },
];

function BadgeFieldsSelect({ value, onChange }) {
  return (
    <label className="control-block">
     <div className="label">Badge Info</div> 
      <select
        multiple
        value={value}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
      >
        {badgeFieldOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GroupBySelect({ value, onChange }) {
  return (
    <label className="control-block">
      <div className="label">Group by</div>
      <select
        multiple
        value={value}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
      >
        {groupFieldOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SeverityFilters({ selected, onToggle }) {
  return (
    <div className="control-block">
      <div className="label">Severity</div>
      <div className="sev-filters">
        {severityOptions.map((s) => (
          <label key={s}>
            <input
              type="checkbox"
              checked={selected.includes(s)}
              onChange={(e) => onToggle(s, e.target.checked)}
            />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}

function ArrowToggle({ mode, onChange }) {
  return (
    <div className="control-block">
      <div className="label">Connections</div>
      <div className="arrow-toggle">
        <label>
          <input type="radio" name="arrowmode" value="show" checked={mode === 'show'} onChange={() => onChange('show')} />
          Show arrows
        </label>
        <label>
          <input type="radio" name="arrowmode" value="hide" checked={mode === 'hide'} onChange={() => onChange('hide')} />
          Hide arrows
        </label>
        <label>
          <input type="radio" name="arrowmode" value="custom" checked={mode === 'custom'} onChange={() => onChange('custom')} />
          Custom line
        </label>
      </div>
    </div>
  );
}

export default function App() {
  const { merged, userIncidents, setUserIncidents } = useIncidents();
  const [severityFilter, setSeverityFilter] = useState(severityOptions);
  const [groupFields, setGroupFields] = useState(['asset']); // entity lanes
  const [badgeFields, setBadgeFields] = useState(['title']); // only event name
  const [arrowMode, setArrowMode] = useState('custom'); // custom lines by default
  const [theme, setTheme] = useState('dark'); // default dark mode
  const [showTeamZones, setShowTeamZones] = useState(false);
  const [activeTab, setActiveTab] = useState('viz');
  const [customLinks, setCustomLinks] = useState([]);
  const [reports, setReports] = useState([]); // uploaded docs
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisEvents, setAnalysisEvents] = useState([]);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisConfidence, setAnalysisConfidence] = useState(null);
  const [analysisRaw, setAnalysisRaw] = useState('');
  const [promptKey, setPromptKey] = useState('default');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.openai.com/v1/chat/completions');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('qwen3:8b');
  const [availableOllamaModels, setAvailableOllamaModels] = useState(['qwen3:8b', 'gemma3:4b']);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const groupByTeam = groupFields.includes('team');
  const promptOptions = useMemo(() => Object.keys(EVENT_ANALYSIS_PROMPTS), []);

  // Prune custom links when incidents change (e.g., events removed)
  useEffect(() => {
    const ids = new Set(merged.map((d) => d.id));
    setCustomLinks((prev) => prev.filter((l) => ids.has(l?.from?.id) && ids.has(l?.to?.id)));
  }, [merged]);

  useEffect(() => {
    if (!groupByTeam && showTeamZones) setShowTeamZones(false);
  }, [groupByTeam, showTeamZones]);

  // Fetch available Ollama models (best effort)
  useEffect(() => {
    if (!useOllama) return;
    fetch('http://localhost:11434/api/tags')
      .then((res) => res.ok ? res.json() : Promise.reject(res.statusText))
      .then((json) => {
        const names = (json.models || []).map((m) => m.name).filter(Boolean);
        if (names.length) {
          setAvailableOllamaModels(names);
          if (!names.includes(ollamaModel)) setOllamaModel(names[0]);
        }
      })
      .catch(() => {
        // silent fallback to defaults
      });
  }, [useOllama]);

  const linkTotals = useMemo(() => {
    const sumByColor = (color) =>
      customLinks
        .filter((l) => (color ? l.color === color : true))
        .reduce((acc, l) => acc + (new Date(l.to.start) - new Date(l.from.start)), 0);
    const red = sumByColor('red');
    const blue = sumByColor('blue');
    const delay = sumByColor('delay');
    const firstStart = (color) => {
      const starts = customLinks.filter((l) => l.color === color).map((l) => new Date(l.from.start).getTime());
      const min = Math.min(...starts);
      return Number.isFinite(min) ? min : null;
    };
    const firstRed = firstStart('red');
    const firstBlue = firstStart('blue');
    const mttd = firstRed !== null && firstBlue !== null ? Math.max(0, firstBlue - firstRed) : null;
    return { red, blue, delay, mttd };
  }, [customLinks]);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const filtered = useMemo(
    () => merged.filter((d) => severityFilter.includes(d.severity || 'low')),
    [merged, severityFilter],
  );

  const addUserEvent = (evt) => addUserEventHelper(userIncidents, setUserIncidents, evt);
  const updateUserEvent = (id, field, value) => updateUserEventHelper(userIncidents, setUserIncidents, id, field, value);
  const deleteUserEvent = (id) => deleteUserEventHelper(userIncidents, setUserIncidents, id);
  const deleteReport = makeDeleteReportHandler({
    setReports,
    selectedReportId,
    setSelectedReportId,
    setAnalysisResult,
    setAnalysisConfidence,
    setAnalysisError,
    setAnalysisEvents,
    setAnalysisRaw,
  });

  const handleMoveTeam = (id, column) => {
    const pretty = column.charAt(0).toUpperCase() + column.slice(1);
    updateUserEvent(id, 'team', pretty);
  };
  const handleMoveTactic = (id, tactic) => {
    const value = `${tactic.id} ${tactic.label}`;
    updateUserEvent(id, 'tactic', value);
  };

  const clearUserEvents = () => clearUserEventsHelper(setUserIncidents);
  const addRow = () => addRowHelper(userIncidents, setUserIncidents);
  const importEvents = (arr) => importEventsHelper(userIncidents, setUserIncidents, arr);
  const exportEvents = () => exportEventsHelper(userIncidents);

  return (
    <div className={`app ${theme}`}>
      <header>
        <div className="brand">
          <img src="/glassonion-logo-tran.png" alt="CyberTimeline logo" className="brand-logo" />
          <div className="brand-text">
            <div className="eyebrow">CyberTimeline</div>
            <div className="brand-title">Read the Attack</div>
          </div>
        </div>
        <div className="controls">
          <div className="control-block totals">
            <div className="label">Attack Time</div>
            <ul className="totals-list">
              <li className="total-item">
                <span className="chip red">Red</span>
                <strong>{formatDuration(linkTotals.red)}</strong>
              </li>
              <li className="total-item blue-item">
                <span className="chip blue">Blue</span>
                <strong>{formatDuration(linkTotals.blue)}</strong>
              </li>
              <li className="total-item">
                <span className="chip gray">MTTD</span>
                <strong>{linkTotals.mttd !== null ? formatDuration(linkTotals.mttd) : '—'}</strong>
              </li>
              <li className="total-item delay-item">
                <span className="chip delay">Delay</span>
                <strong>{formatDuration(linkTotals.delay)}</strong>
              </li>
            </ul>
          </div>
          <div className="control-block">
            <div className="label">Theme</div>
            <div className="arrow-toggle">
              <label>
                <input type="radio" name="theme" value="light" checked={theme === 'light'} onChange={() => setTheme('light')} />
                Light
              </label>
              <label>
                <input type="radio" name="theme" value="dark" checked={theme === 'dark'} onChange={() => setTheme('dark')} />
                Dark
              </label>
            </div>
            <label className="checkbox-inline" title={groupByTeam ? 'Tint lanes by Event Team' : 'Select "Event Team" in Group by to enable'}>
              <input
                type="checkbox"
                checked={showTeamZones}
                disabled={!groupByTeam}
                onChange={(e) => setShowTeamZones(e.target.checked)}
              />
              Team Zones
            </label>
          </div>
          <SeverityFilters selected={severityFilter} onToggle={(sev, checked) => setSeverityFilter((prev) => (checked ? [...prev, sev] : prev.filter((s) => s !== sev)))} />
          <ArrowToggle mode={arrowMode} onChange={setArrowMode} />
          <GroupBySelect value={groupFields} onChange={setGroupFields} />
          <BadgeFieldsSelect value={badgeFields} onChange={setBadgeFields} />
        </div>
      </header>

      <main>
        <div className="tabs">
          <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>
            Reports
          </button>
          <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>
            Events
          </button>
          <button className={activeTab === 'ctf' ? 'active' : ''} onClick={() => setActiveTab('ctf')}>
            CTF
          </button>
          <button className={activeTab === 'mitre' ? 'active' : ''} onClick={() => setActiveTab('mitre')}>
            MITRE
          </button>
          <button className={activeTab === 'viz' ? 'active' : ''} onClick={() => setActiveTab('viz')}>
            Timeline
          </button>
        </div>

        {activeTab === 'viz' && (
          <section className="panel">
            <Timeline
              data={filtered}
              groupFields={groupFields}
              badgeFields={badgeFields}
              arrowMode={arrowMode}
              customLinks={customLinks}
              setCustomLinks={setCustomLinks}
              showTeamZones={showTeamZones}
            />
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="panel">
            <ReportsPane
              reports={reports}
              selectedId={selectedReportId}
              analysisResult={analysisResult}
              analysisEvents={analysisEvents}
              analysisError={analysisError}
              analysisConfidence={analysisConfidence}
              analysisRaw={analysisRaw}
              promptKey={promptKey}
              promptOptions={promptOptions}
              onPromptKeyChange={setPromptKey}
              apiKey={apiKey}
              apiEndpoint={apiEndpoint}
              onApiKeyChange={setApiKey}
              onApiEndpointChange={setApiEndpoint}
              openaiModel={openaiModel}
              onOpenaiModelChange={setOpenaiModel}
              loading={analysisLoading}
              useOllama={useOllama}
              onToggleOllama={setUseOllama}
              ollamaModel={ollamaModel}
              onOllamaModelChange={setOllamaModel}
              availableOllamaModels={availableOllamaModels}
              onDeleteReport={deleteReport}
              onSendToEvents={(evs) => {
                const source = Array.isArray(evs)
                  ? evs
                  : analysisEvents?.length
                    ? analysisEvents
                    : analysisResult
                      ? [analysisResult]
                      : [];
                if (!source.length) return;
                setUserIncidents((prev) => {
                  const toInsert = source.map((ev, idx) => ({
                    ...ev,
                    // Ensure timeline entity uses the asset field; fall back to entity if needed.
                    asset: ev.asset || ev.entity || 'Unknown',
                    id: ev.id || `analysis-${Date.now()}-${idx}`,
                  }));
                  const merged = [...prev, ...toInsert];
                  saveUserIncidents(merged);
                  return merged;
                });
              }}
              onUpload={(items) => {
                setReports((prev) => [...prev, ...items]);
                if (!selectedReportId && items.length) setSelectedReportId(items[0].id);
              }}
              onSelect={setSelectedReportId}
                onAnalyze={makeAnalyzeHandler({
                  reports,
                  selectedReportId,
                  useOllama,
                  ollamaModel,
                  openaiModel,
                  promptKey,
                  apiKey,
                  apiEndpoint,
                  setAnalysisLoading,
                  setAnalysisResult,
                  setAnalysisEvents,
                  setAnalysisConfidence,
                  setAnalysisRaw,
                  setAnalysisError,
                })}
              />
          </section>
        )}

        {activeTab === 'ctf' && (
          <section className="panel">
            <CtfPane events={filtered} onMoveTeam={handleMoveTeam} />
          </section>
        )}

        {activeTab === 'mitre' && (
          <section className="panel">
            <MitrePane events={filtered} onMoveTactic={handleMoveTactic} />
          </section>
        )}

        {activeTab === 'events' && (
          <section className="panel stack">
            <AddEventForm onAdd={addUserEvent} onClear={() => setShowClearConfirm(true)} />
            <EventsTable
              events={userIncidents}
              onChange={updateUserEvent}
              onDelete={deleteUserEvent}
              onAddRow={addRow}
              onImport={importEvents}
              onExport={exportEvents}
              severityOptions={severityOptions}
            />
          </section>
        )}
      </main>

      {showClearConfirm && (
        <div
          className="link-popup report-popup"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 50,
          }}
        >
          <div className="link-popup-title">Clear all user events?</div>
          <div className="popup-actions">
            <button
              className="red"
              onClick={() => {
                clearUserEvents();
                setShowClearConfirm(false);
              }}
            >
              Delete
            </button>
            <button className="ghost" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
