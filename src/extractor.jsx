import { buildEventAnalysisPrompt } from './prompts';

const DEFAULT_OLLAMA_MODEL = 'qwen3:8b';
const DEFAULT_OPENAI_MODEL = 'gpt-4o';

// Pull the first balanced JSON object/array (optionally fenced) out of a model response.
// The scanner tolerates extra prose by finding the first complete JSON block.
function extractJsonBlock(text) {
  if (!text) throw new Error('Empty response from model.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const trimmed = candidate.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to balanced scan
  }
  const stack = [];
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{' || ch === '[') {
      if (stack.length === 0) start = i;
      stack.push(ch === '{' ? '}' : ']');
    } else if ((ch === '}' || ch === ']') && stack.length) {
      if (ch === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0 && start !== -1) {
          const jsonStr = trimmed.slice(start, i + 1);
          try {
            return JSON.parse(jsonStr);
          } catch {
            // continue scanning
          }
        }
      }
    }
  }
  throw new Error('No valid JSON object found in model response.');
}

// Normalize various model JSON shapes into { event, events, confidence }.
// Accepts single-event objects, { events: [] }, { results: [] }, or a bare array of events.
function coerceEvents(parsed) {
  const combined = [];
  if (Array.isArray(parsed?.events)) combined.push(...parsed.events);
  if (Array.isArray(parsed?.results)) combined.push(...parsed.results);
  if (parsed?.event) combined.push(parsed.event);
  if (Array.isArray(parsed) && combined.length === 0) combined.push(...parsed);
  const events = combined;
  const primary = events[0] || parsed?.event || parsed;
  return {
    event: primary ? { ...primary, id: primary.id || `analysis-${Date.now()}` } : null,
    events,
    confidence: parsed?.confidence || {},
  };
}

// Run extraction against Ollama or OpenAI and return parsed events plus raw text.
// Chooses the provider based on useOllama and applies the appropriate API contract.
export async function analyzeWithLLM({ content, name, useOllama, ollamaModel, apiKey, apiEndpoint, promptKey, openaiModel }) {
  const { system: systemPrompt, user: prompt } = buildEventAnalysisPrompt({ content, name }, promptKey);

  // Parse model output to the normalized structure while preserving the raw text.
  const parseModelResponse = (contentText) => {
    try {
      const parsed = extractJsonBlock(contentText);
      const { event, events, confidence } = coerceEvents(parsed);
      return { event, events, confidence, raw: contentText };
    } catch {
      return { event: null, events: [], confidence: {}, raw: contentText };
    }
  };

  if (useOllama) {
    // Use the local Ollama HTTP API for offline/localhost analysis.
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel || DEFAULT_OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }
    const data = await response.json();
    return parseModelResponse(data.response || '');
  }

  // Use explicit API key override or fall back to the Vite env var.
  const key = apiKey || import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI API key is required.');
  const resolvedModel = openaiModel || DEFAULT_OPENAI_MODEL;
  // Call the OpenAI chat completion endpoint with JSON-only output enforced.
  const resolvedEndpoint = apiEndpoint || 'https://api.openai.com/v1/chat/completions';
  console.log('OpenAI request', { endpoint: resolvedEndpoint, hasKey: !!key, model: resolvedModel, promptKey });
  const response = await fetch(resolvedEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('OpenAI error', response.status, text);
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }
  const data = await response.json();
  const contentText = data.choices?.[0]?.message?.content || '';
  return parseModelResponse(contentText);
}

// Utility export if only JSON extraction is needed without network calls.
export function extractJsonFromText(text) {
  return extractJsonBlock(text);
}

