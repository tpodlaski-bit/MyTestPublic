import { useEffect, useMemo, useState } from 'react';

const USER_KEY = 'cybertimeline_user_incidents_v1';

export function inferTactic(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const checks = [
    { tactic: 'TA0043 Reconnaissance', keys: ['recon', 'scan', 'enumerat', 'footprint'] },
    { tactic: 'TA0001 Initial Access', keys: ['phishing', 'spear', 'exploit', 'drive-by', 'malware drop'] },
    { tactic: 'TA0002 Execution', keys: ['execute', 'payload', 'powershell', 'command run'] },
    { tactic: 'TA0003 Persistence', keys: ['persistence', 'startup', 'autorun', 'scheduled task'] },
    { tactic: 'TA0004 Privilege Escalation', keys: ['privilege escalation', 'privesc', 'elevation'] },
    { tactic: 'TA0005 Defense Evasion', keys: ['obfusc', 'evasion', 'disable security', 'tamper'] },
    { tactic: 'TA0006 Credential Access', keys: ['credential', 'password', 'hash', 'brute force', 'keylog'] },
    { tactic: 'TA0007 Discovery', keys: ['discovery', 'enumerat', 'list user', 'query domain'] },
    { tactic: 'TA0008 Lateral Movement', keys: ['lateral', 'psexec', 'remote desktop', 'spread'] },
    { tactic: 'TA0009 Collection', keys: ['collect', 'archive', 'gather data', 'compress'] },
    { tactic: 'TA0011 Command and Control', keys: ['c2', 'command and control', 'beacon', 'callback'] },
    { tactic: 'TA0010 Exfiltration', keys: ['exfil', 'data theft', 'leak', 'upload'] },
    { tactic: 'TA0040 Impact', keys: ['destroy', 'wipe', 'encrypt', 'ransomware', 'dos'] },
  ];
  for (const c of checks) {
    if (c.keys.some((k) => text.includes(k))) return c.tactic;
  }
  return 'Unknown';
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function loadUserIncidents() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveUserIncidents(arr) {
  localStorage.setItem(USER_KEY, JSON.stringify(arr));
}

export function toLocalDatetimeInput(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useIncidents() {
  const [baseIncidents] = useState([]);
  const [userIncidents, setUserIncidents] = useState([]);

  useEffect(() => {
    setUserIncidents(loadUserIncidents());
  }, []);

  const merged = useMemo(() => {
    const users = userIncidents.map((u) => ({
      ...u,
      start: parseDate(u.start),
      end: parseDate(u.end),
      severity: (u.severity || 'low').toLowerCase(),
      tactic: u.tactic || inferTactic(u.title, u.description),
    }));
    return [...baseIncidents, ...users];
  }, [baseIncidents, userIncidents]);

  return { merged, userIncidents, setUserIncidents, baseIncidents };
}

export function addUserEvent(userIncidents, setUserIncidents, evt) {
  const updated = [...userIncidents, evt];
  setUserIncidents(updated);
  saveUserIncidents(updated);
}

export function updateUserEvent(userIncidents, setUserIncidents, id, field, value) {
  const updated = userIncidents.map((u) => {
    if (u.id !== id) return u;
    if (field === 'start') {
      const local = new Date(value);
      if (Number.isNaN(local.getTime())) return u;
      const utcIso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
      return { ...u, start: utcIso };
    }
    return { ...u, [field]: value };
  });
  setUserIncidents(updated);
  saveUserIncidents(updated);
}

export function deleteUserEvent(userIncidents, setUserIncidents, id) {
  const updated = userIncidents.filter((u) => u.id !== id);
  setUserIncidents(updated);
  saveUserIncidents(updated);
}

export function clearUserEvents(setUserIncidents) {
  setUserIncidents([]);
  saveUserIncidents([]);
}

export function addRow(userIncidents, setUserIncidents) {
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
  const updated = [
    ...userIncidents,
    {
      id: 'user-' + Date.now(),
      title: 'New event',
      start: iso,
      end: null,
      asset: 'New-Entity',
      category: '',
      team: '',
      tactic: 'Unknown',
      severity: 'low',
      host: '',
    },
  ];
  setUserIncidents(updated);
  saveUserIncidents(updated);
}

export function importEvents(userIncidents, setUserIncidents, arr) {
  const normalized = arr.map((evt, idx) => {
    const copy = { ...evt };
    if (!copy.id) copy.id = 'imported-' + Date.now() + '-' + idx;
    if (!copy.start) throw new Error(`Event ${idx} missing required field: start`);
    if (!copy.title) copy.title = `Event ${idx}`;
    if (!copy.asset) copy.asset = 'Unknown';
    if (!copy.team) copy.team = 'Unknown';
    if (!copy.tactic) copy.tactic = inferTactic(copy.title, copy.description);
    if (copy.start instanceof Date) copy.start = copy.start.toISOString();
    else if (typeof copy.start === 'string' && !copy.start.endsWith('Z')) copy.start = copy.start + 'Z';
    return copy;
  });
  const mergedEvents = [...userIncidents, ...normalized];
  setUserIncidents(mergedEvents);
  saveUserIncidents(mergedEvents);
}

export function exportEvents(userIncidents) {
  const blob = new Blob([JSON.stringify(userIncidents, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user-events.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
