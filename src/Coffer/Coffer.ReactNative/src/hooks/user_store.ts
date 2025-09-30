import { create } from "zustand";
import User from "../types/entities/user";
import { UserStore } from "../types/helpers/data_store";

export function initUserStore(user: User) {
  useUserStore = createUserStore(user);
}

export const createUserStore = (initialUser: User) =>
  create<UserStore>(() => ({
    user: initialUser,
  }));

export let useUserStore: ReturnType<typeof createUserStore>;
