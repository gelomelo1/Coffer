// Mirrors the marketplace DTOs of the backend (Coffer.BusinessLogic/Marketplace). Enums travel as snake_case strings.

export type ListingKind = "sell" | "exchange" | "wanted";
export type ListingCondition = "new" | "like_new" | "good" | "fair" | "poor";
export type ListingStatus = "active" | "pending_pickup" | "pending_shipment" | "sold" | "archived" | "removed";
export type DeliveryMethod = "local_pickup" | "shipping";
export type ParticipantRole = "owner" | "inquirer";
export type MessageKind = "text" | "price_offer" | "meetup_proposal" | "system";
export type ProposalStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type DealStatus =
  | "proposed"
  | "awaiting_handoff"
  | "awaiting_shipment"
  | "shipped"
  | "completed"
  | "disputed"
  | "cancelled";
export type CompletionReason = "handoff_verified" | "receipt_confirmed" | "auto_completed" | "moderator";
export type ReviewerRole = "buyer" | "seller";
export type ReviewReasonTag =
  | "item_not_as_described"
  | "late_to_meetup"
  | "no_show"
  | "poor_communication"
  | "damaged_in_shipping"
  | "slow_shipping"
  | "payment_problem"
  | "rude_behavior"
  | "other";
export type ReportTargetType = "listing" | "message" | "review" | "item" | "comment";

/** My Listings filter chips (backend groups the existing statuses). */
export type MyListingsFilter = "active" | "sold" | "archived";
export type ReportRule =
  | "illegal_item"
  | "counterfeit"
  | "scam_or_fraud"
  | "harassment"
  | "personal_data"
  | "spam"
  | "fake_review"
  | "off_topic"
  | "other";
export type ReportStatus = "open" | "resolved";
export type ReportDecision = "removed" | "no_violation" | "suspended";
export type DealAction =
  | "accept"
  | "decline"
  | "cancel"
  | "show_pin"
  | "enter_pin"
  | "ship"
  | "confirm_receipt"
  | "dispute"
  | "review";
export type ListingSort = "nearest" | "price_asc" | "price_desc" | "newest";

export interface UserSummary {
  id: string;
  /** Empty for a deleted account: show it with userLabel(). */
  name: string;
  avatar?: string | null;
  /** The account was deleted: a placeholder ("Deleted user"), no profile to open. */
  isDeleted?: boolean;
}

export interface City {
  id: number;
  name: string;
  admin1?: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface ListingLine {
  name: string;
  quantity: number;
}

export interface ListingImage {
  id: string;
  fileName: string;
}

export interface ListingSummary {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  priceCents?: number | null;
  currency: string;
  exchangeFor?: string | null;
  condition?: ListingCondition | null;
  collectionTypeId: number;
  collectionTypeName: string;
  collectionTypeColor: string;
  cityId: number;
  cityName: string;
  distanceKm?: number | null;
  firstImage?: string | null;
  allowsLocalPickup: boolean;
  allowsShipping: boolean;
  privateSellerDeclared: boolean;
  createdAt: string;
  owner: UserSummary;
  /** Seller's profile country (ISO alpha-2). */
  sellerCountry?: string | null;
}

export interface ListingDetail {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  description?: string | null;
  priceCents?: number | null;
  currency: string;
  exchangeFor?: string | null;
  condition?: ListingCondition | null;
  collectionTypeId: number;
  collectionTypeName: string;
  collectionTypeColor: string;
  city: City;
  allowsLocalPickup: boolean;
  allowsShipping: boolean;
  privateSellerDeclared: boolean;
  lines: ListingLine[];
  images: ListingImage[];
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  isMine: boolean;
  myConversationId?: string | null;
  openDealId?: string | null;
}

export interface ListingInput {
  kind: ListingKind;
  collectionTypeId: number;
  title: string;
  description?: string | null;
  priceCents?: number | null;
  exchangeFor?: string | null;
  condition?: ListingCondition | null;
  cityId: number;
  allowsLocalPickup: boolean;
  allowsShipping: boolean;
  lines: ListingLine[];
  keepImageIds?: string[] | null;
  privateSellerDeclared: boolean;
}

export interface ListingFilters {
  kind?: ListingKind;
  collectionTypeId?: number;
  city?: City;
  radiusKm?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  condition?: ListingCondition;
  delivery?: DeliveryMethod;
  /** Seller nationality: ISO alpha-2 codes of the seller's profile country (any of them). */
  sellerCountries?: string[];
  sort: ListingSort;
}

export interface SubjectSummary {
  id: string;
  type: string;
  title: string;
  image?: string | null;
  status?: string | null;
  kind?: string | null;
  priceCents?: number | null;
  /** The listing went with its owner's account: show it with listingLabel(). */
  isDeleted?: boolean;
}

export interface Message {
  id: string;
  senderId?: string | null;
  kind: MessageKind;
  body: string;
  amountCents?: number | null;
  at?: string | null;
  place?: string | null;
  status?: ProposalStatus | null;
  isRemoved: boolean;
  createdAt: string;
  /** System messages: market:system.<systemCode> with these params; body is the English fallback. */
  systemCode?: string | null;
  systemParams?: Record<string, string> | null;
}

export interface Conversation {
  id: string;
  subject: SubjectSummary;
  myRole: ParticipantRole;
  other: UserSummary;
  agreedPriceCents?: number | null;
  openDealId?: string | null;
  lastMessageAt: string;
  /** The chat's newest deal in any state. */
  latestDealId?: string | null;
}

export interface ConversationSummary {
  id: string;
  subject: SubjectSummary;
  myRole: ParticipantRole;
  other: UserSummary;
  /** English preview; the app builds its own from lastMessage. */
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage?: Message | null;
}

export interface PostMessageInput {
  kind: MessageKind;
  body?: string | null;
  amountCents?: number | null;
  at?: string | null;
  place?: string | null;
}

export interface Carrier {
  code: string;
  label: string;
}

/** An open trade that keeps the account from being deleted (GET api/Account/Deletion). */
export interface BlockingDeal {
  dealId: string;
  conversationId: string;
  listingTitle: string;
  other: UserSummary;
  status: DealStatus;
  /** Not shipped yet: can be cancelled now. */
  canCancel: boolean;
  /** Shipped: completes by itself at the latest then (earlier when the buyer confirms or disputes). */
  endsLatestAt?: string | null;
}

export interface AccountDeletionStatus {
  canDelete: boolean;
  blockingDeals: BlockingDeal[];
}

export interface Deal {
  id: string;
  listingId: string;
  listingTitle: string;
  /** The listing went with its owner's account: show it with listingLabel(). */
  listingDeleted?: boolean;
  listingImage?: string | null;
  listingKind: ListingKind;
  conversationId: string;
  seller: UserSummary;
  buyer: UserSummary;
  myRole: ReviewerRole;
  method: DeliveryMethod;
  status: DealStatus;
  agreedPriceCents?: number | null;
  meetupAt?: string | null;
  meetupPlace?: string | null;
  handoffPin?: string | null;
  handoffQr?: string | null;
  pinLockedUntil?: string | null;
  carrier?: string | null;
  carrierLabel?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shipmentPhoto?: string | null;
  shippedAt?: string | null;
  autoCompleteAt?: string | null;
  receiptPhoto?: string | null;
  receivedAt?: string | null;
  completedAt?: string | null;
  completionReason?: CompletionReason | null;
  reviewDeadline?: string | null;
  disputeReason?: string | null;
  disputedAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  nextActions: DealAction[];
}

export interface Review {
  id: string;
  dealId: string;
  listingTitle: string;
  /** The listing went with its owner's account: show it with listingLabel(). */
  listingDeleted?: boolean;
  reviewer?: UserSummary | null;
  reviewee: UserSummary;
  reviewerRole: ReviewerRole;
  stars: number;
  reasonTag?: ReviewReasonTag | null;
  comment?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  reply?: string | null;
  repliedAt?: string | null;
  isFrozen: boolean;
}

export interface ReviewInput {
  stars: number;
  reasonTag?: ReviewReasonTag | null;
  comment?: string | null;
}

export interface DealReviews {
  mine?: Review | null;
  theirs?: Review | null;
  theyHaveSubmitted: boolean;
  canReview: boolean;
  deadline?: string | null;
}

export interface Reputation {
  average?: number | null;
  count: number;
  completedDeals: number;
  responseRate?: number | null;
  typicalResponseMinutes?: number | null;
}

export interface ReportRuleInfo {
  rule: ReportRule;
  label: string;
  description: string;
  appliesTo: ReportTargetType[];
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  rule: ReportRule;
  reason: string;
}

export interface MyReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  listingId?: string | null;
  conversationId?: string | null;
  /** Collection item the report is about (item reports, and the item a comment belongs to). */
  itemId?: string | null;
  targetSummary: string;
  rule: ReportRule;
  reason: string;
  status: ReportStatus;
  decision?: ReportDecision | null;
  statement?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/** Statement of reasons for my removed content. Never says who reported it. */
export interface ModerationActionItem {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  listingId?: string | null;
  conversationId?: string | null;
  itemId?: string | null;
  rule: ReportRule;
  ruleLabel: string;
  statement: string;
  contentExcerpt: string;
  createdAt: string;
  seen: boolean;
}

export interface TermsStatus {
  currentVersion: string;
  acceptedVersion?: string | null;
  accepted: boolean;
  acceptedAt?: string | null;
}

/** Returned by every blocked request while the account is suspended (and by GET api/Account/Suspension). */
export interface AccountSuspension {
  message?: string;
  reason: string;
  startsAt: string;
  endsAt: string;
}
