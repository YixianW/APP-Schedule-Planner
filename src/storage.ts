import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EventItem, PlanItem } from './types';

export const storageKeys = {
  events: '@ai_schedule_planner/events',
  plan: '@ai_schedule_planner/plan',
  planText: '@ai_schedule_planner/plan_text',
} as const;

export async function loadEvents(): Promise<EventItem[]> {
  const stored = await AsyncStorage.getItem(storageKeys.events);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as EventItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveEvents(events: EventItem[]): Promise<void> {
  await AsyncStorage.setItem(storageKeys.events, JSON.stringify(events));
}

export async function loadPlan(): Promise<{ items: PlanItem[]; rawText: string }> {
  const [itemsStored, textStored] = await Promise.all([
    AsyncStorage.getItem(storageKeys.plan),
    AsyncStorage.getItem(storageKeys.planText),
  ]);

  let items: PlanItem[] = [];
  if (itemsStored) {
    try {
      const parsed = JSON.parse(itemsStored) as PlanItem[];
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }
  }

  return { items, rawText: textStored ?? '' };
}

export async function savePlan(items: PlanItem[], rawText: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(storageKeys.plan, JSON.stringify(items)),
    AsyncStorage.setItem(storageKeys.planText, rawText),
  ]);
}