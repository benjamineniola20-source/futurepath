import { supabase } from "./supabase";
import bundledPack from "../data/utme-offline-pack.json";

export type OfflineSubject = { id: string; name: string; slug: string; description: string };
export type OfflineTopic = { id: string; subject_id: string; title: string; slug: string; description: string; sort_order: number };
export type OfflineNote = { id: string; subject_id: string; topic_id?: string | null; title: string; summary: string; content: string };
export type OfflineQuestion = {
  id: string; subject_id: string; topic_id?: string | null; topic_title: string | null;
  question_text: string; options: string[]; correct_option: number; explanation: string;
  exam_type: string; exam_year: number | null; source_label?: string;
};
export type OfflineSnapshot = {
  subjects: OfflineSubject[]; topics: OfflineTopic[]; notes: OfflineNote[]; questions: OfflineQuestion[];
  downloadedAt: string | null;
};
export type OfflineAttempt = {
  id: string; client_attempt_id: string; subject_id: string; mode: "quiz" | "practice" | "mock";
  started_at: string; submitted_at: string; duration_seconds: number; total_questions: number;
  correct_answers: number; score_percent: number; answers: { question_id: string; selected_option: number | null }[];
  synced: boolean;
};

const DB_NAME = "futurepath-offline";
const DB_VERSION = 1;
const CONTENT_STORE = "content";
const ATTEMPT_STORE = "attempts";
const ACTIVE_STORE = "active_exam";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Offline storage is not available on this device."));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONTENT_STORE)) db.createObjectStore(CONTENT_STORE);
      if (!db.objectStoreNames.contains(ATTEMPT_STORE)) db.createObjectStore(ATTEMPT_STORE, { keyPath: "client_attempt_id" });
      if (!db.objectStoreNames.contains(ACTIVE_STORE)) db.createObjectStore(ACTIVE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
  });
}

async function readValue<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => { resolve(request.result as T | undefined); db.close(); };
    request.onerror = () => { reject(request.error); db.close(); };
  });
}

async function writeValue(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    if (store.keyPath) store.put(value);
    else store.put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function allValues<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => { resolve(request.result as T[]); db.close(); };
    request.onerror = () => { reject(request.error); db.close(); };
  });
}

export async function getOfflineSnapshot(): Promise<OfflineSnapshot> {
  const cached = await readValue<OfflineSnapshot>(CONTENT_STORE, "snapshot");
  if (cached?.subjects?.length && cached?.questions?.length) return cached;

  // Seed IndexedDB from the bundled question pack on a fresh install.
  const snapshot: OfflineSnapshot = {
    subjects: (bundledPack.subjects || []) as OfflineSubject[],
    topics: (bundledPack.topics || []) as OfflineTopic[],
    notes: (bundledPack.notes || []) as OfflineNote[],
    questions: (bundledPack.questions || []) as OfflineQuestion[],
    downloadedAt: bundledPack.exported_at || null,
  };
  if (snapshot.subjects.length && snapshot.questions.length) {
    await writeValue(CONTENT_STORE, snapshot, "snapshot");
  }
  return snapshot;
}

export async function syncOfflineContent(): Promise<OfflineSnapshot> {
  if (!supabase || !navigator.onLine) throw new Error("Connect to the internet to download learning materials.");
  const { data, error } = await supabase.rpc("get_offline_content");
  if (error) throw error;
  const snapshot = {
    subjects: data?.subjects || [],
    topics: data?.topics || [],
    notes: data?.notes || [],
    questions: data?.questions || [],
    downloadedAt: new Date().toISOString(),
  } as OfflineSnapshot;
  await writeValue(CONTENT_STORE, snapshot, "snapshot");
  return snapshot;
}

export async function getLocalAttempts(): Promise<OfflineAttempt[]> {
  return (await allValues<OfflineAttempt>(ATTEMPT_STORE)).sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

export async function saveOfflineAttempt(attempt: OfflineAttempt): Promise<void> {
  await writeValue(ATTEMPT_STORE, attempt);
}

export async function syncPendingOfflineAttempts(): Promise<number> {
  if (!supabase || !navigator.onLine) return 0;
  const attempts = await getLocalAttempts();
  let synced = 0;
  for (const attempt of attempts.filter((item) => !item.synced)) {
    const { error } = await supabase.rpc("sync_offline_attempt", {
      p_client_attempt_id: attempt.client_attempt_id,
      p_subject_id: attempt.subject_id,
      p_mode: attempt.mode,
      p_answers: attempt.answers,
      p_duration_seconds: attempt.duration_seconds,
    });
    if (error) break;
    await saveOfflineAttempt({ ...attempt, synced: true });
    synced += 1;
  }
  return synced;
}

export async function saveActiveExam<T>(exam: T): Promise<void> {
  await writeValue(ACTIVE_STORE, exam, "current");
}

export async function getActiveExam<T>(): Promise<T | null> {
  return (await readValue<T>(ACTIVE_STORE, "current")) || null;
}

export async function clearActiveExam(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ACTIVE_STORE, "readwrite");
    tx.objectStore(ACTIVE_STORE).delete("current");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function makeLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export type OfflineAccount = { id: string; email: string; full_name?: string };
export async function saveOfflineAccount(account: OfflineAccount): Promise<void> {
  await writeValue(CONTENT_STORE, account, "offline-account");
}
export async function getOfflineAccount(): Promise<OfflineAccount | null> {
  return (await readValue<OfflineAccount>(CONTENT_STORE, "offline-account")) || null;
}
export async function clearOfflineAccount(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CONTENT_STORE, "readwrite");
    tx.objectStore(CONTENT_STORE).delete("offline-account");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
