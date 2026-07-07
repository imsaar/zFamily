/**
 * A curated library of common household chores. Picking one just pre-fills
 * the chore editor (title / icon / points / recurrence); the user still
 * chooses who it's assigned to and confirms. No DB rows — this is static
 * starter content, mirroring the verse/RRULE constant pattern.
 *
 * `recurrence` uses the same encoding decoded by `isDueOn` in chores.ts:
 *   'daily' | 'weekdays' | 'weekends' | 'weekly:<CSV of SUN..SAT>'
 */

export type ChoreTemplate = {
  title: string;
  icon: string;
  points: number;
  recurrence: string;
};

export const CHORE_TEMPLATES: ChoreTemplate[] = [
  { title: "Empty the dishwasher", icon: "🍽️", points: 1, recurrence: "daily" },
  { title: "Load the dishwasher", icon: "🧼", points: 1, recurrence: "daily" },
  { title: "Clean the kitchen", icon: "🧽", points: 2, recurrence: "daily" },
  { title: "Wipe the table", icon: "🧻", points: 1, recurrence: "daily" },
  { title: "Set the table", icon: "🍴", points: 1, recurrence: "daily" },
  { title: "Take out the garbage", icon: "🗑️", points: 1, recurrence: "daily" },
  { title: "Take garbage & recycling to the curb", icon: "♻️", points: 2, recurrence: "weekly:SUN" },
  { title: "Make your bed", icon: "🛏️", points: 1, recurrence: "daily" },
  { title: "Tidy your room", icon: "🧸", points: 1, recurrence: "daily" },
  { title: "Feed the pet", icon: "🐾", points: 1, recurrence: "daily" },
  { title: "Water the plants", icon: "🪴", points: 1, recurrence: "weekly:WED" },
  { title: "Vacuum the living room", icon: "🧹", points: 2, recurrence: "weekends" },
  { title: "Do the laundry", icon: "🧺", points: 2, recurrence: "weekends" },
  { title: "Fold & put away laundry", icon: "👕", points: 2, recurrence: "weekends" },
  { title: "Clean the bathroom", icon: "🚿", points: 3, recurrence: "weekly:SAT" },
  { title: "Sweep the floors", icon: "🧹", points: 1, recurrence: "weekdays" },
  { title: "Pack your school bag", icon: "🎒", points: 1, recurrence: "weekdays" },
  { title: "Homework", icon: "📚", points: 2, recurrence: "weekdays" },
  { title: "Bring in the mail", icon: "📮", points: 1, recurrence: "weekdays" },
  { title: "Mow the lawn", icon: "🌱", points: 3, recurrence: "weekly:SAT" },
];
