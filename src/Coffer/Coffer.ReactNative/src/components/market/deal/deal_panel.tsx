import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { dealStatusColors, dealStatusLabels, deliveryLabels } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { Deal, DeliveryMethod, ListingDetail } from "@/src/types/entities/market";
import { daysLeft, formatDate, formatDateTime, formatPrice, LocalImage, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Linking, TouchableOpacity, View } from "react-native";
import ReviewModal from "../review/review_modal";
import { Chip, ChipRow, ListingImageView, SectionCard, Tag, WarningBanner } from "../ui/retro";
import TextPromptOverlay from "../ui/text_prompt_overlay";
import { PinDisplay, PinEntry } from "./pin_components";
import { ReceiptOverlay, ShipOverlay } from "./shipping_overlays";

const c = customTheme.colors;

/**
 * The single "what do I do next" panel on top of a chat. Everything it offers comes from the backend's
 * deal.nextActions, so the UI can never offer a step the state machine would reject.
 */
function DealPanel({
  deal,
  listing,
  conversationId,
  iAmSeller,
}: {
  deal: Deal | null | undefined;
  listing: ListingDetail | undefined;
  conversationId: string;
  iAmSeller: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const propose = useMarketMutation((m: DeliveryMethod) => marketApi.proposeDeal(conversationId, m), "Deal proposed");
  const accept = useMarketMutation((id: string) => marketApi.acceptDeal(id), "Deal accepted");
  const decline = useMarketMutation((id: string) => marketApi.declineDeal(id), "Deal declined");
  const cancel = useMarketMutation(({ id, reason }: { id: string; reason: string }) => marketApi.cancelDeal(id, reason || undefined), "Deal cancelled");
  const handoff = useMarketMutation(({ id, pin }: { id: string; pin: string }) => marketApi.confirmHandoff(id, pin), "Handoff verified — deal completed!");
  const ship = useMarketMutation(
    ({ id, carrier, tracking, photo }: { id: string; carrier: string; tracking: string; photo: LocalImage | null }) =>
      marketApi.ship(id, carrier, tracking, photo),
    "Shipment registered",
  );
  const receipt = useMarketMutation(({ id, photo }: { id: string; photo: LocalImage | null }) => marketApi.confirmReceipt(id, photo), "Deal completed");
  const dispute = useMarketMutation(({ id, reason }: { id: string; reason: string }) => marketApi.dispute(id, reason), "Deal closed as disputed");

  const openDeal = deal && !["completed", "cancelled", "disputed"].includes(deal.status) ? deal : null;
  const finishedDeal = deal && (deal.status === "completed" || deal.status === "disputed") ? deal : null;
  const canPropose = iAmSeller && !openDeal && listing?.status === "active";
  const methods: DeliveryMethod[] = [
    ...(listing?.allowsLocalPickup ? (["local_pickup"] as DeliveryMethod[]) : []),
    ...(listing?.allowsShipping ? (["shipping"] as DeliveryMethod[]) : []),
  ];

  const header = (
    <TouchableOpacity onPress={() => setCollapsed(!collapsed)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <ListingImageView fileName={listing?.images[0]?.fileName} style={{ width: 40, height: 40 }} />
      <View style={{ flex: 1 }}>
        <CustomText style={{ fontFamily: "VendSansBold" }} numberOfLines={1}>
          {listing?.title ?? "Listing"}
        </CustomText>
        {deal ? (
          <CustomText style={{ fontSize: 13, color: dealStatusColors[deal.status] }}>
            {deliveryLabels[deal.method]} · {dealStatusLabels[deal.status]}
          </CustomText>
        ) : (
          <CustomText style={{ fontSize: 13 }}>No deal yet</CustomText>
        )}
      </View>
      <MaterialIcons name={collapsed ? "expand-more" : "expand-less"} size={24} color={c.primary} />
    </TouchableOpacity>
  );

  if (collapsed) return <SectionCard style={{ margin: 8, marginBottom: 4 }}>{header}</SectionCard>;

  const d = openDeal ?? finishedDeal ?? deal;
  const has = (a: Deal["nextActions"][number]) => !!d?.nextActions.includes(a);

  return (
    <SectionCard style={{ margin: 8, marginBottom: 4 }}>
      {header}

      {d ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Tag label={dealStatusLabels[d.status]} color={dealStatusColors[d.status]} />
            {d.agreedPriceCents ? <Tag label={formatPrice(d.agreedPriceCents)} color={c.secondary} textColor={c.primary} /> : null}
          </View>
          {d.meetupAt ? (
            <CustomText style={{ fontSize: 14 }}>
              Meetup: {formatDateTime(d.meetupAt)} · {d.meetupPlace}
            </CustomText>
          ) : null}
          {d.status === "cancelled" && d.cancelReason ? <CustomText style={{ fontSize: 13 }}>{d.cancelReason}</CustomText> : null}

          {has("accept") ? (
            <>
              <WarningBanner />
              <CustomText>
                {d.seller.name} proposes {deliveryLabels[d.method].toLowerCase()}
                {d.agreedPriceCents ? ` for ${formatPrice(d.agreedPriceCents)}` : ""}.
              </CustomText>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <CustomButton title="Decline" disabled={decline.isPending} onPress={() => decline.mutate(d.id)} />
                </View>
                <View style={{ flex: 1 }}>
                  <CustomButton title="Accept deal" loading={accept.isPending} disabled={accept.isPending} onPress={() => accept.mutate(d.id)} />
                </View>
              </View>
            </>
          ) : null}

          {has("show_pin") && d.handoffPin && d.handoffQr ? <PinDisplay pin={d.handoffPin} qr={d.handoffQr} /> : null}
          {has("enter_pin") ? (
            <PinEntry
              loading={handoff.isPending}
              lockedUntil={d.pinLockedUntil}
              onSubmit={(pin) => handoff.mutate({ id: d.id, pin })}
            />
          ) : null}

          {has("ship") ? <CustomButton title="Register shipment" onPress={() => setShipOpen(true)} /> : null}
          {d.status === "awaiting_shipment" && !has("ship") ? (
            <CustomText>Waiting for {d.seller.name} to ship and add the tracking number.</CustomText>
          ) : null}

          {d.trackingNumber ? (
            <View style={{ gap: 4 }}>
              <CustomText>
                {d.carrierLabel}: <CustomText style={{ fontFamily: "VendSansBold" }}>{d.trackingNumber}</CustomText>
              </CustomText>
              {d.trackingUrl ? (
                <TouchableOpacity onPress={() => Linking.openURL(d.trackingUrl!)} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <MaterialIcons name="open-in-new" size={16} color={c.primary} />
                  <CustomText style={{ textDecorationLine: "underline" }}>Check on the carrier&apos;s website</CustomText>
                </TouchableOpacity>
              ) : null}
              {d.shipmentPhoto ? <ListingImageView deal fullScreen fileName={d.shipmentPhoto} style={{ width: 80, height: 80 }} /> : null}
              {d.status === "shipped" && d.autoCompleteAt ? (
                <CustomText style={{ fontSize: 13 }}>
                  Completes automatically on {formatDate(d.autoCompleteAt)} unless a problem is reported.
                </CustomText>
              ) : null}
            </View>
          ) : null}

          {has("confirm_receipt") ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <CustomButton title="Report a problem" onPress={() => setDisputeOpen(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <CustomButton title="I received it" onPress={() => setReceiptOpen(true)} />
              </View>
            </View>
          ) : null}

          {d.status === "disputed" ? (
            <View style={{ gap: 4 }}>
              <CustomText style={{ fontSize: 14 }}>
                The buyer reported a problem{d.disputeReason ? `: “${d.disputeReason}”` : "."}
              </CustomText>
              <CustomText style={{ fontSize: 13 }}>
                Coffer doesn&apos;t decide who is right — please sort it out together. You can both leave an honest review.
              </CustomText>
            </View>
          ) : null}

          {d.status === "completed" || d.status === "disputed" ? (
            has("review") ? (
              <>
                <CustomText>
                  Deal done! Rate each other within {daysLeft(d.reviewDeadline)} days. Reviews stay hidden until both of you submit.
                </CustomText>
                <CustomButton title="★ Leave a review" onPress={() => setReviewOpen(true)} />
              </>
            ) : (
              <Chip label="See reviews" icon={<MaterialIcons name="star" size={16} color={c.secondary} />} onPress={() => setReviewOpen(true)} />
            )
          ) : null}

          {has("cancel") ? (
            <TouchableOpacity onPress={() => setCancelOpen(true)} style={{ alignSelf: "flex-start" }}>
              <CustomText style={{ color: "red", textDecorationLine: "underline", fontSize: 14 }}>Cancel deal</CustomText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {canPropose ? (
        <View style={{ gap: 6, marginTop: d ? 8 : 0 }}>
          <CustomText style={{ fontFamily: "VendSansBold" }}>Agreed? Propose the deal</CustomText>
          <ChipRow>
            {methods.map((m) => (
              <Chip key={m} label={deliveryLabels[m]} selected={method === m} onPress={() => setMethod(m)} />
            ))}
          </ChipRow>
          {method === "shipping" ? <WarningBanner /> : null}
          <CustomButton
            title="Propose deal"
            disabled={!method || propose.isPending}
            loading={propose.isPending}
            onPress={() => method && propose.mutate(method)}
          />
        </View>
      ) : !d && !iAmSeller ? (
        <CustomText style={{ fontSize: 13 }}>When you agree, the seller proposes the deal here and you accept it.</CustomText>
      ) : null}

      {d ? (
        <>
          <TextPromptOverlay
            isVisible={cancelOpen}
            onClose={() => setCancelOpen(false)}
            title="Cancel deal"
            explanation="The listing becomes available again. No review is possible for a cancelled deal."
            placeholder="Reason (optional)"
            submitLabel="Cancel deal"
            maxLength={300}
            loading={cancel.isPending}
            onSubmit={(reason) => cancel.mutate({ id: d.id, reason }, { onSuccess: () => setCancelOpen(false) })}
          />
          <TextPromptOverlay
            isVisible={disputeOpen}
            onClose={() => setDisputeOpen(false)}
            title="Report a problem"
            explanation="This closes the deal as disputed and shows your description to the seller in this chat. Coffer does not decide who is right or handle refunds — sort it out with the seller. You can both leave an honest review afterwards."
            placeholder="What went wrong? (e.g. not arrived, damaged, different item)"
            submitLabel="Close as disputed"
            minLength={20}
            maxLength={1000}
            loading={dispute.isPending}
            onSubmit={(reason) => dispute.mutate({ id: d.id, reason }, { onSuccess: () => setDisputeOpen(false) })}
          />
          <ShipOverlay
            isVisible={shipOpen}
            onClose={() => setShipOpen(false)}
            loading={ship.isPending}
            onSubmit={(carrier, tracking, photo) =>
              ship.mutate({ id: d.id, carrier, tracking, photo }, { onSuccess: () => setShipOpen(false) })
            }
          />
          <ReceiptOverlay
            isVisible={receiptOpen}
            onClose={() => setReceiptOpen(false)}
            loading={receipt.isPending}
            onSubmit={(photo) => receipt.mutate({ id: d.id, photo }, { onSuccess: () => setReceiptOpen(false) })}
          />
          <ReviewModal isVisible={reviewOpen} onClose={() => setReviewOpen(false)} deal={d} />
        </>
      ) : null}
    </SectionCard>
  );
}

export default DealPanel;
