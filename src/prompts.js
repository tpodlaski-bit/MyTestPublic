// Central catalog of event-analysis prompt variants keyed by name.
// Each entry contains:
// - system: the system message used by the model
// - user: a builder that injects request-specific content into the prompt body
const EVENT_ANALYSIS_PROMPTS = {
  default: {
    // System-level instruction for the chat completion call.
    system: 'Extract a single cyber incident event in JSON.',
    // Full extraction + inference instruction block with content placeholders.
    user: ({ content, name }) => `You are a cybersecurity incident analysis system.

The input text may describe ZERO, ONE, or MULTIPLE distinct events.
You must:
- Split the text into distinct events when appropriate
- Return ONE JSON OBJECT PER EVENT
- Preserve the original order of events as they appear in the text

You must produce TWO SEPARATE SECTIONS in the output:
1) extracted
2) inferred

These sections have DIFFERENT RULES.
Do NOT mix them.

EXTRACTION RULES (STRICT):

- Extract ONLY facts that are explicitly stated in the input text.
- Do NOT infer, guess, generalize, or rephrase.
- If a value is not explicitly present, use null or an empty array.
- Do NOT introduce new entities or relationships.
- Threat actors must be explicitly named to be included.
- Output must match the extraction schema exactly.

{
  "extracted": {
    "incident_id": string | null,
    "date": string | null,
    "affected_system": string | null,
    "description": string | null,
    "threat_actor": string | null,
    "ttp": string[],
    "iocs": {
      "ip": string[],
      "domain": string[],
      "hash": string[],
      "url": string[]
    },
    "impact": string | null,
    "status": string | null
  }
}

INFERENCE RULES:

- Inference is OPTIONAL and must be based ONLY on the extracted section.
- Do NOT introduce information that contradicts extracted facts.
- All inferred fields must include a confidence score (0.0ƒ?"1.0).
- If confidence is below 0.4, return null for that field.
- Clearly mark inferred fields as hypotheses, not facts.

{
  "inferred": {
    "likely_attack_type": {
      "value": string | null,
      "confidence": number
    },
    "likely_mitre_techniques": [
      {
        "value": string,
        "confidence": number
      }
    ],
    "severity": {
      "value": "low" | "medium" | "high" | "critical" | null,
      "confidence": number
    }
  }
}
  OUTPUT RULES:

- Return a SINGLE valid JSON object array of events.
- Each object must contain exactly two top-level keys: "extracted" and "inferred".
- Do NOT include explanations, markdown, or comments.
- Do NOT merge extracted and inferred fields.
- Use null instead of guessing.

- Text to extract from:
"""${content}"""
Filename: ${name}`,
  },

  simple:{
    //simple prompt for testing
    system: 'Extract cyber incident events in JSON.',
    user: ({ content, name }) => `You are an assistant that extracts a chain of cyber incident events from unstructured text.

For extracted events return ONLY valid JSON shaped as:
{
  "events": [
    {
      "title": string,
      "description": string,
      "start": ISO8601 string or null,
      "end": ISO8601 string or null,
      "entity": string,
      "host": string,
      "system" :  string,
      "team": one of ["Red","Blue","Gray","Unknown"]
      "category:" one of ["Malware","Phishing","Ransomware","DDoS","Data Breach","Vulnerability","Insider Threat","Other"],
      "tactic": one MITRE ATT&CK tactic ID (e.g TA0003,TA0010): tactic name (e.g., "Reconnaissance","Initial Access","Execution","Persistence","Privilege Escalation","Defense Evasion","Credential Access","Discovery","Lateral Movement","Collection","Command and Control","Exfiltration","Impact"),
      "confidence": {
        "title": 0-100,
        "description": 0-100,
        "start": 0-100,
        "end": 0-100,
        "entity": 0-100,
        "host": 0-100,
        "system": 0-100,
        "team": 0-100,
        "category": 0-100
        "tactic": 0-100
      }
    }
  ]
}

Instructions:
- Return at least one event if possible; if none are found, return "events": [].
- Prefer earliest mentioned date/time as "start"; if none, use current UTC. "end" can be null/blank if not present.
- Account, identity or user affected goes in "entity".
- Hostnames, IPs, or systems involved go in "host"
- Detection or logging systems go in "system"
- Infer "category" using keywords;
- Infer "team":
  * Red for attacker/adversary actions (verbs like exploit, phish, deliver, scan, brute-force, deploy malware, beacon, exfiltrate, pivot, tamper)
  * Blue for defender/response actions (verbs like detect, alert, investigate, triage, contain, isolate, block, patch, restore)
  * Gray for user (verbs like misconfigure, click, approve, vendor actions), or when actor is neutral/external
  * Unknown if you cannot determine
- Infer "tactic" using MITRE ATT&CK tactics; use MITRE technique keywords to choose the best fitting tactic. If uncertain, set "Unknown".
- Keep "title" concise; "description" should summarize key details.
- Assess "confidence" per field for each event by how clearly that field value is supported by the text (0=guess, 100=explicitly stated). Confidence must reflect evidence: 100 only if explicitly stated; inferred values should be 50–80; guesses or unclear info should be <=40.
- The JSON must be well-formed and contain multiple entires "event" if applicable.
- The JSON should have newline formatting and indentation for readability.
- The JSON should have all fields present; use null or empty strings where data is missing.
- Do not include anything outside the JSON.

- Text to extract from:
"""${content}"""
Filename: ${name}`,
  },
  experimental_simple_with_confidence: {
    system: 'Extract cyber incident events in JSON.',
    user: ({ content, name }) => `You are an assistant that extracts a chain of cyber incident events from unstructured text.

Output Rules:
- return a single JSON object with EXACTLY one top-level key "events".
- "events" is an array of "event" objects.
- new line usually means new event.
- if you cannot confidently populate a field, set it to null or "Unknown".
- output ONLY the JSON object; no markdown, no prose.
- if you cannot produce events, return { "events": [] }.
- all braces and brackets must be closed; the JSON must be valid.

Expected shape:
{
  "events": [
    {
      "title": string,
      "description": string,
      "start": ISO8601 string or null,
      "entity": string or null,
      "host": string or null,
      "team": "Red" | "Blue" | "Gray" | "Unknown",
      "tactic": "ID and Name" or null,
      "confidence": {
        "title": 0-100,
        "description": 0-100,
        "start": 0-100,
        "entity": 0-100,
        "host": 0-100,
        "team": 0-100,
        "tactic": 0-100
      }
          }
  ]
}

Extraction Rules:
- Only include information supported by the input text; if a field is not stated, use null or "Unknown".
- "title" is concise, 3-5 words.
- "description" summarizes key details, 1 sentence.
- "entity" is the affected account, identity, or user.
- "host" is the affected hostname, IP, or system.

Inference Rules:
- Infer "team":
  * Red for attacker/adversary actions (verbs like exploit, phish, deliver, scan, brute-force, deploy malware, beacon, exfiltrate, pivot, tamper)
  * Blue for defender/response actions (verbs like detect, alert, investigate, triage, contain, isolate, block, patch, restore)
  * Gray for user (verbs like misconfigure, click, approve, vendor actions), or when actor is neutral/external
  * Unknown if you cannot determine
- Infer "tactic" using MITRE ATT&CK tactics ID and Name; use MITRE technique keywords to choose the best fitting tactic. If uncertain, set "Unknown".

Confidence Rules:
- For each field in an event, assign a confidence score from 0 to 100 based on how clearly the text supports that field's value:
  * 100: Explicitly stated in the text
  * 70: Strongly implied or clearly inferred
  * 50: Somewhat implied but not clear
  * 20: Weakly implied or mostly a guess
  * 0: Pure guess with no supporting evidence
  * Use null for fields you cannot confidently populate.

Input:
"""${content}"""
Filename: ${name}`,
  },
  extract_simple_no_confidence: {
    system: 'Extract cyber incident events in JSON.',
    user: ({ content, name }) => `You are an assistant that extracts a chain of cyber incident events from unstructured text.

Output Rules:
- return a single JSON object with EXACTLY one top-level key "events".
- "events" is an array of "event" objects.
- new line usually means new event.
- if you cannot confidently populate a field, set it to null or "Unknown".
- output ONLY the JSON object; no markdown, no prose.
- if you cannot produce events, return { "events": [] }.
- all braces and brackets must be closed; the JSON must be valid.

Expected shape:
{
  "events": [
    {
      "title": string,
      "description": string,
      "start": ISO8601 string or null,
      "entity": string or null,
      "host": string or null,
      "team": "Red" | "Blue" | "Gray" | "Unknown",
      "tactic": "ID and Name" or null,
          }
  ]
}

Extraction Rules:
- Only include information supported by the input text; if a field is not stated, use null or "Unknown".
- "title" is concise, 3-5 words.
- "description" summarizes key details, 1 sentence.
- "entity" is the affected account, identity, or user.
- "host" is the affected hostname, IP, or system.

Inference Rules:
- Infer "team":
  * Red for attacker/adversary actions (verbs like exploit, phish, deliver, scan, brute-force, deploy malware, beacon, exfiltrate, pivot, tamper)
  * Blue for defender/response actions (verbs like detect, alert, investigate, triage, contain, isolate, block, patch, restore)
  * Gray for user (verbs like misconfigure, click, approve, vendor actions), or when actor is neutral/external
  * Unknown if you cannot determine
- Infer "tactic" using MITRE ATT&CK tactics ID and Name; use MITRE technique keywords to choose the best fitting tactic. If uncertain, set "Unknown".

Input:
"""${content}"""
Filename: ${name}`,
  },
};

// Build the concrete system/user messages for a prompt key (defaults to "default").
// Falls back to the default prompt if the requested key does not exist.
function buildEventAnalysisPrompt({ content, name }, promptKey = 'default') {
  const config = EVENT_ANALYSIS_PROMPTS[promptKey] || EVENT_ANALYSIS_PROMPTS.default;
  return {
    system: config.system,
    user: config.user({ content, name }),
  };
}

export { EVENT_ANALYSIS_PROMPTS, buildEventAnalysisPrompt };

//show first exercies only tred
//show today blue
//show the future - and start speaking about MTTD
//use timelines

//first year putting everything into a bag
//sedond year trying to make sense of it all, lookig for what is valuable
//third year trying to make it all work together
