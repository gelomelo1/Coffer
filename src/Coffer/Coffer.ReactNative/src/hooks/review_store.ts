import { navigate } from "expo-router/build/global-state/routing";
import { create } from "zustand";
import { pageParams, ROUTES } from "../const/navigation_params";

/** The collection whose waiting-for-review list is open on the review screen. */
export interface ReviewTarget {
  collectionId: string;
  collectionName: string;
  collectionTypeId: number;
}

interface ReviewStore {
  target: ReviewTarget | null;
  setTarget: (target: ReviewTarget | null) => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}));

/** Opens the review screen on a collection's waiting list (newest caps first). */
export function openReview(target: ReviewTarget) {
  useReviewStore.getState().setTarget(target);
  navigate({ pathname: ROUTES.REVIEW, params: pageParams.review(target.collectionName) });
}
