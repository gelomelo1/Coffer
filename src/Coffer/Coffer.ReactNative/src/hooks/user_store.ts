import { create } from "zustand";
import User, { UserStore } from "../types/entities/user";

export function initUserStore(user: User) {
  useUserStore = createUserStore(user);
}

export const createUserStore = (initialUser: User) =>
  create<UserStore>(() => ({
    user: initialUser,
  }));

export let useUserStore: ReturnType<typeof createUserStore>;
