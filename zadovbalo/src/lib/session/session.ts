"use client";

import type { CategoryId } from "@/lib/topics/categories";
import type { MechanicType } from "@/lib/mechanics/types";

/**
 * Анонімна сесія у sessionStorage: лише ідентифікатори тем і механік, без тексту.
 * Живе до закриття вкладки й нікуди не відправляється.
 */
export interface AnonymousSession {
  id: string;
  startedAt: string;
  topics: CategoryId[];
  chosenMechanics: MechanicType[];
  completedFlows: CategoryId[];
}

const KEY = "zadovbalo:session";

function read(): AnonymousSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnonymousSession) : null;
  } catch {
    return null;
  }
}

function write(session: AnonymousSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // приватний режим / заблоковане сховище — працюємо без сесії
  }
}

export function startSession(): AnonymousSession {
  const session: AnonymousSession = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    topics: [],
    chosenMechanics: [],
    completedFlows: [],
  };
  write(session);
  return session;
}

export function updateSession(update: (s: AnonymousSession) => AnonymousSession) {
  const current = read() ?? startSession();
  write(update(current));
}

const addUnique = <T,>(list: T[], value: T) => (list.includes(value) ? list : [...list, value]);

export const sessionLog = {
  topics: (categories: CategoryId[]) => updateSession((s) => ({ ...s, topics: [...new Set([...s.topics, ...categories])] })),
  mechanic: (type: MechanicType) => updateSession((s) => ({ ...s, chosenMechanics: addUnique(s.chosenMechanics, type) })),
  completed: (category: CategoryId) => updateSession((s) => ({ ...s, completedFlows: addUnique(s.completedFlows, category) })),
};
