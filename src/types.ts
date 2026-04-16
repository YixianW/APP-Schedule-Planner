export type EventItem = {
  id: string;
  name: string;
  time: string;
  location: string;
  notes: string;
  updatedAt: number;
};

export type PlanItem = {
  time: string;
  action: string;
  reason: string;
};