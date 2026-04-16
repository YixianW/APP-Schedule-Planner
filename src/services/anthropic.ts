import type { EventItem, PlanItem } from '../types';

type AnthropicMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
};

export type OptimizedPlanResponse = {
  plan: PlanItem[];
  rawText: string;
};

const MODEL_NAME = 'claude-sonnet-4-20250514';

export async function generateOptimizedPlan(events: EventItem[], apiKey: string): Promise<OptimizedPlanResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        max_tokens: 1200,
        temperature: 0.2,
        system:
          'You are a schedule planning assistant. Return only valid JSON with a single key named "plan". The value must be an array of objects with string fields "time", "action", and "reason". Do not include markdown or extra commentary.',
        messages: [{ role: 'user', content: createPlanningPrompt(events) }],
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as AnthropicMessageResponse | null;
      const message = errorBody?.error?.message ?? `Claude API request failed with status ${response.status}.`;
      throw new Error(message);
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const rawText = extractText(data);

    if (!rawText) {
      throw new Error('Claude returned an empty response.');
    }

    return { plan: safeParsePlan(rawText), rawText };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error. Check your connection and try again.');
    }

    throw error instanceof Error ? error : new Error('Unable to generate plan.');
  }
}

function extractText(response: AnthropicMessageResponse) {
  return response.content
    ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim() ?? '';
}

function safeParsePlan(rawText: string): PlanItem[] {
  const jsonText = extractJsonBlock(rawText);
  if (!jsonText) {
    throw new Error('Claude response was not valid JSON.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Claude response could not be parsed.');
  }

  const plan = (parsed as { plan?: unknown }).plan;
  if (!Array.isArray(plan)) {
    throw new Error('Claude response is missing the plan array.');
  }

  return plan
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const time = typeof item.time === 'string' ? item.time.trim() : '';
      const action = typeof item.action === 'string' ? item.action.trim() : '';
      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';

      if (!time || !action || !reason) {
        return null;
      }

      return { time, action, reason };
    })
    .filter((value): value is PlanItem => value !== null);
}

function extractJsonBlock(rawText: string) {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return rawText.slice(start, end + 1).trim();
  }

  return '';
}

function createPlanningPrompt(events: EventItem[]) {
  const eventSummary = events
    .map((event, index) => {
      const parts = [
        `${index + 1}. name: ${event.name}`,
        `time: ${event.time}`,
        event.location ? `location: ${event.location}` : null,
        event.notes ? `notes: ${event.notes}` : null,
      ].filter(Boolean);

      return parts.join(', ');
    })
    .join('\n');

  return [
    'Create a practical single-day schedule from the events below.',
    'Estimate travel and buffer time with reasonable assumptions when locations are present.',
    'Flag any conflicts or tight transitions inside the reason field.',
    'Return JSON in this exact shape: {"plan":[{"time":"...","action":"...","reason":"..."}] }',
    'Sort the plan chronologically and keep the response concise but useful.',
    '',
    'Events:',
    eventSummary,
  ].join('\n');
}