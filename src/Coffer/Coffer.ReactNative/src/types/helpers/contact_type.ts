export const CONTACT_TYPES = ["Phone", "Facebook", "Instagram"] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
