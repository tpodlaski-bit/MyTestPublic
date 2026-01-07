import { useRef, useState } from 'react';
import { analyzeWithLLM } from './extractor';

// Manage uploads and analysis workflow for report documents.
export function ReportsPane({
  reports,
  selectedId,
  onUpload,
  onSelect,
  onAnalyze,
  analysisResult,
  analysisEvents,
  analysisError,
  analysisConfidence,
  analysisRaw,
  promptKey,
  promptOptions,
  onPromptKeyChange,
  apiKey,
  onApiKeyChange,
  apiEndpoint,
  onApiEndpointChange,
  openaiModel,
  onOpenaiModelChange,
  loading,
  useOllama,
  onToggleOllama,
  ollamaModel,
  onOllamaModelChange,
  availableOllamaModels,
  onDeleteReport,
  onSendToEvents,
}) {
  const fileInputRef = useRef(null);
  const [reportDeletePopup, setReportDeletePopup] = useState(null);
  const openaiModelOptions = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5.1', 'gpt-5-mini'];
  const hasEnvKey = Boolean(import.meta.env?.VITE_OPENAI_API_KEY);

  // Read uploaded files and convert them into report items.
  const handleFiles = (files) => {
    const uploads = [];
    const readers = Array.from(files).map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            uploads.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, content: e.target.result || '' });
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsText(file);
        }),
    );
    Promise.all(readers).then(() => {
      if (uploads.length) onUpload(uploads);
    });
  };

  // Parse raw model output into normalized event objects.
  const parseRawEvents = (raw) => {
    if (!raw) return [];
    const extractJsonSnippet = (text) => {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = (fenced ? fenced[1] : text).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // fall through to balanced scan
      }
      let start = -1;
      const stack = [];
      for (let i = 0; i < candidate.length; i++) {
        const ch = candidate[i];
        if (ch === '{' || ch === '[') {
          if (stack.length === 0) start = i;
          stack.push(ch === '{' ? '}' : ']');
        } else if ((ch === '}' || ch === ']') && stack.length) {
          if (ch === stack[stack.length - 1]) {
            stack.pop();
            if (stack.length === 0 && start !== -1) {
              const snippet = candidate.slice(start, i + 1);
              try {
                JSON.parse(snippet);
                return snippet;
              } catch {
                // keep scanning
              }
            }
          }
        }
      }
      return candidate;
    };

    try {
      const parsed = JSON.parse(extractJsonSnippet(raw));
      const combined = [];
      if (Array.isArray(parsed?.events)) combined.push(...parsed.events);
      if (Array.isArray(parsed?.results)) combined.push(...parsed.results);
      if (parsed?.event) combined.push(parsed.event);
      if (Array.isArray(parsed) && combined.length === 0) combined.push(...parsed);
      return combined;
    } catch {
      // ignore parse errors
    }
    return [];
  };

  const rawEvents = parseRawEvents(analysisRaw);
  const displayedEvents = analysisEvents?.length
    ? analysisEvents
    : rawEvents.length
      ? rawEvents
      : analysisResult
        ? [analysisResult]
        : [];

  // Map confidence values to CSS classes for table styling.
  const confClass = (val) => {
    if (typeof val !== 'number') return '';
    if (val >= 80) return 'conf-high';
    if (val >= 50) return 'conf-med';
    return 'conf-low';
  };

  return (
    <div className="reports">
      <div className="reports-controls">
        <button onClick={() => fileInputRef.current?.click()}>Upload Document</button>
        <label className="toggle-line">
          <input type="checkbox" checked={useOllama} onChange={(e) => onToggleOllama(e.target.checked)} />
          Use Local LLM
        </label>
        {useOllama ? (
          availableOllamaModels && availableOllamaModels.length ? (
            <select
              className="api-key-input"
              value={ollamaModel}
              onChange={(e) => onOllamaModelChange(e.target.value)}
            >
              {availableOllamaModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="api-key-input"
              placeholder="Ollama model (e.g., qwen3:8b)"
              value={ollamaModel}
              onChange={(e) => onOllamaModelChange(e.target.value)}
            />
          )
        ) : (
          <>
            <input
              type="text"
              className="api-key-input"
              placeholder="OpenAI endpoint"
              value={apiEndpoint}
              onChange={(e) => onApiEndpointChange(e.target.value)}
            />
            <select
              className="api-key-input"
              value={openaiModel}
              onChange={(e) => onOpenaiModelChange(e.target.value)}
            >
              {openaiModelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="password"
              className="api-key-input"
              placeholder="OpenAI API Key"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
            />
          </>
        )}
        <label className="toggle-line">
          Prompt
          <select
            className="api-key-input"
            value={promptKey}
            onChange={(e) => onPromptKeyChange(e.target.value)}
          >
            {promptOptions.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            console.log('Analyze click', { selectedId, loading, useOllama, hasApiKey: !!apiKey, hasEnvKey, openaiModel });
            onAnalyze();
          }}
          disabled={!selectedId || loading || (!useOllama && !apiKey && !hasEnvKey)}
        >
          Analyze with AI Agent
        </button>
        {loading && <span className="muted">Analyzing…</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.doc,.docx"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      <div className="reports-layout">
        <div className="reports-list">
          <h3>Uploaded</h3>
          {reports.length === 0 && <div className="muted">No documents yet.</div>}
          <ul>
            {reports.map((r) => (
              <li
                key={r.id}
                className={r.id === selectedId ? 'active' : ''}
                onClick={() => onSelect(r.id)}
              >
                <span className="report-name">{r.name}</span>
                <button
                  className="ghost small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setReportDeletePopup({ id: r.id, name: r.name, x: rect.left, y: rect.bottom + window.scrollY });
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="reports-right">
          <div className="reports-preview">
            <h3>Preview</h3>
            {selectedId ? (
              <pre>{reports.find((r) => r.id === selectedId)?.content || ''}</pre>
            ) : (
              <div className="muted">Select a document to preview.</div>
            )}
          </div>
          <div className="reports-preview">
            <h3>AI Agent Output</h3>
            <div className="muted" style={{ marginBottom: 6 }}>
              Run started: {localStorage.getItem('lastLLMTime') || '(unknown)'} • Duration: {localStorage.getItem('lastLLMDuration') || '(unknown)'}
            </div>
            <div className="ai-legend">
              <span><span className="swatch swatch-green" /> 100–80 (high confidence)</span>
              <span><span className="swatch swatch-yellow" /> 80–50 (medium)</span>
              <span><span className="swatch swatch-red" /> 50–0 (low)</span>
            </div>
            {displayedEvents && displayedEvents.length ? (
              <div className="ai-events-table-wrap">
                <table className="ai-events-table">
                  <thead>
                    <tr>
                      <th>Start</th>
                      <th>Title</th>
                      <th>Tactic</th>
                      <th>Entity</th>
                      <th>Host</th>
                      <th>Description</th>
                      <th>System</th>
                      <th>Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEvents.map((ev, idx) => {
                      const conf = ev.confidence || {};
                      return (
                        <tr key={ev.id || idx}>
                          <td className={confClass(conf.start)}>{ev.start || '(no start)'}</td>
                          <td className={confClass(conf.title)}>{ev.title || '(no title)'}</td>
                          <td className={confClass(conf.tactic)}>{ev.tactic || 'Unknown'}</td>
                          <td className={confClass(conf.entity)}>{ev.entity || ev.asset || 'Unknown'}</td>
                          <td className={confClass(conf.host)}>{ev.host || 'Unknown'}</td>
                          <td className={confClass(conf.description)}>{ev.description || 'No description'}</td>
                          <td className={confClass(conf.system)}>{ev.system || 'Unknown'}</td>
                          <td className={confClass(conf.team)}>{ev.team || 'Unknown'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="muted">No extracted events yet.</div>
            )}
          </div>
          <div className="analysis-actions bottom-actions">
            <button
              className="ghost"
              onClick={() => onSendToEvents(displayedEvents)}
              disabled={!displayedEvents.length}
            >
              Send to Events
            </button>
            <button
              className="ghost"
              onClick={() => window.open('/AIoutput.html', '_blank', 'noopener,noreferrer')}
            >
              AI RAW Output
            </button>
          </div>
        </div>
      </div>
      {reportDeletePopup && (
        <div
          className="link-popup report-popup"
          style={{
            position: 'absolute',
            left: reportDeletePopup.x,
            top: reportDeletePopup.y + 8,
            zIndex: 30,
          }}
        >
          <div className="link-popup-title">Delete "{reportDeletePopup.name}"?</div>
          <div className="popup-actions">
            <button
              className="red"
              onClick={() => {
                onDeleteReport?.(reportDeletePopup.id);
                setReportDeletePopup(null);
              }}
            >
              Delete
            </button>
            <button className="ghost" onClick={() => setReportDeletePopup(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Build a delete handler that also clears analysis state when the selected report is removed.
export function makeDeleteReportHandler({
  setReports,
  selectedReportId,
  setSelectedReportId,
  setAnalysisResult,
  setAnalysisConfidence,
  setAnalysisError,
  setAnalysisEvents,
  setAnalysisRaw,
}) {
  // Return a handler that deletes a report and clears analysis state.
  return (id) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (selectedReportId === id) {
      setSelectedReportId(null);
      setAnalysisResult(null);
      setAnalysisConfidence(null);
      setAnalysisError('');
      setAnalysisEvents([]);
      setAnalysisRaw('');
    }
  };
}

// Build the analyze handler using the current report selection and model settings.
export function makeAnalyzeHandler({
  reports,
  selectedReportId,
  useOllama,
  ollamaModel,
  promptKey,
  apiKey,
  apiEndpoint,
  openaiModel,
  setAnalysisLoading,
  setAnalysisResult,
  setAnalysisEvents,
  setAnalysisConfidence,
  setAnalysisRaw,
  setAnalysisError,
}) {
  // Return an async handler that runs model analysis for the selected report.
  return async () => {
    const current = reports.find((r) => r.id === selectedReportId);
    if (!current) {
      setAnalysisError('Select a document to analyze.');
      return;
    }
    if (!useOllama && !(apiKey || import.meta.env?.VITE_OPENAI_API_KEY)) {
      setAnalysisError('OpenAI API key is required.');
      return;
    }
    console.log('Analyze start', { reportId: current.id, useOllama, openaiModel, hasApiKey: !!apiKey });
    const started = Date.now();
    try {
      setAnalysisLoading(true);
      const { event, events, confidence, raw } = await analyzeWithLLM({
        content: current.content || '',
        name: current.name,
        useOllama,
        ollamaModel,
        openaiModel,
        promptKey,
        apiKey,
        apiEndpoint,
      });
      setAnalysisResult(event);
      setAnalysisEvents(events || (event ? [event] : []));
      setAnalysisConfidence(confidence);
      setAnalysisRaw(raw || '');
      localStorage.setItem('lastLLMRaw', raw || '');
      localStorage.setItem('lastLLMTime', new Date().toISOString());
      localStorage.setItem('lastLLMModel', useOllama ? (ollamaModel || 'qwen3:8b') : (openaiModel || 'gpt-4o'));
      localStorage.setItem('lastLLMPrompt', promptKey || 'default');
      if (!event && raw) {
        setAnalysisError('Parsed output unavailable; showing raw model response.');
      } else {
        setAnalysisError('');
      }
    } catch (err) {
      setAnalysisError(err.message || 'Failed to analyze document.');
      setAnalysisResult(null);
      setAnalysisEvents([]);
      setAnalysisConfidence(null);
      setAnalysisRaw('');
      localStorage.setItem('lastLLMRaw', '');
    } finally {
      const durationMs = Date.now() - started;
      const seconds = (durationMs / 1000).toFixed(1);
      localStorage.setItem('lastLLMDuration', `${seconds}s`);
      setAnalysisLoading(false);
    }
  };
}

