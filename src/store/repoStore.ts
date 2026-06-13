import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Repo } from '../types';

// nanoid 在 RN 0.76 bridgeless 模式下会报 'Property crypto doesn't exist'。
// repo id 不需要密码学强度，用 Math.random 自造即可。
function makeId(len = 10): string {
  let s = '';
  while (s.length < len) s += Math.random().toString(36).slice(2);
  return s.slice(0, len);
}

type RepoStore = {
  repos: Repo[];
  add: (input: Omit<Repo, 'id' | 'addedAt' | 'lastOpenedAt'>) => Repo;
  remove: (id: string) => void;
  touch: (id: string) => void;
  get: (id: string) => Repo | undefined;
};

export const useRepoStore = create<RepoStore>()(
  persist(
    (set, get) => ({
      repos: [],
      add: (input) => {
        const repo: Repo = {
          id: makeId(10),
          addedAt: Date.now(),
          lastOpenedAt: Date.now(),
          ...input,
        };
        set((s) => ({ repos: [repo, ...s.repos] }));
        return repo;
      },
      remove: (id) => set((s) => ({ repos: s.repos.filter((r) => r.id !== id) })),
      touch: (id) =>
        set((s) => ({
          repos: s.repos.map((r) => (r.id === id ? { ...r, lastOpenedAt: Date.now() } : r)),
        })),
      get: (id) => get().repos.find((r) => r.id === id),
    }),
    {
      name: 'mdreader.repos.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);