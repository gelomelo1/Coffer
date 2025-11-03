import { customTheme } from "../theme/theme";
import { OfferStatus, TradeStatus } from "../types/helpers/barter_status";

export const tradeStatusRecord: Record<
  TradeStatus,
  { label: string; color: string }
> = {
  open: {
    label: "Open",
    color: "green",
  },
  offerAccepted: {
    label: "An offer accepted",
    color: customTheme.colors.secondary,
  },
  offerRevertByCreator: {
    label: "Accepted offer reverted by creator (waiting on offerer)",
    color: "red",
  },
  offerRevertByOfferer: {
    label: "Accepted offer reverted by offerer (waiting on creator)",
    color: "red",
  },
  traded: {
    label: "Traded",
    color: customTheme.colors.primary,
  },
};

export const offerStatusRecord: Record<
  OfferStatus,
  { label: string; color: string }
> = {
  pending: {
    label: "Pending",
    color: "green",
  },
  rejected: {
    label: "Rejected",
    color: "red",
  },
  accepted: {
    label: "Accepted",
    color: customTheme.colors.secondary,
  },
  revertByCreator: {
    label: "This offer reverted by creator (waiting on offerer)",
    color: "red",
  },
  revertByOfferer: {
    label: "This offer reverted by offerer (waiting on creator)",
    color: "red",
  },
  traded: {
    label: "Traded",
    color: customTheme.colors.primary,
  },
};
