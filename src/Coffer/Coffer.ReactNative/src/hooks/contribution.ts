import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePickerAsset } from "expo-image-picker";
import { VoteInput } from "../types/entities/contribution";
import { contributionApi } from "../utils/contribution_api";
import { useUserStore } from "./user_store";

/** Shape What's Next: the page's state. Keyed by the signed-in user (my vote, my counts). */
export function useContribution() {
  const userId = useUserStore((s) => s.user?.id);
  return useQuery({ queryKey: ["contribution", userId ?? ""], queryFn: contributionApi.state, enabled: !!userId });
}

function useRefreshContribution() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["contribution"] });
}

export function useVote() {
  const refresh = useRefreshContribution();
  return useMutation({ mutationFn: (input: VoteInput) => contributionApi.vote(input), onSuccess: refresh });
}

export function useUploadDetection() {
  const refresh = useRefreshContribution();
  return useMutation({
    mutationFn: ({ phaseId, assets }: { phaseId: string; assets: ImagePickerAsset[] }) => contributionApi.uploadDetection(phaseId, assets),
    onSuccess: refresh,
  });
}

export function useUploadClassification() {
  const refresh = useRefreshContribution();
  return useMutation({
    mutationFn: ({ phaseId, assets }: { phaseId: string; assets: ImagePickerAsset[] }) => contributionApi.uploadClassification(phaseId, assets),
    onSuccess: refresh,
  });
}

/** The example galleries (file names); they change rarely. */
export function useContributionExamples() {
  return useQuery({ queryKey: ["contributionExamples"], queryFn: contributionApi.examples, staleTime: 10 * 60 * 1000 });
}
