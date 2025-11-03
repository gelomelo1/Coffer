import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import React from "react";
import { Overlay } from "react-native-elements";

interface DeleteOfferOverlayProps {
  offer: Offer;
  isDeleteOfferOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function DeleteOfferOverlay({
  offer,
  isDeleteOfferOverlayVisible,
}: DeleteOfferOverlayProps) {
  const navigate = useResetNavigation();
  const { mutateAsync: deleteOffer, isPending } = useDeleteData(
    endpoints.offers,
    `${querykeys.myOffersData};${querykeys.tradesData}`
  );

  const handleOverlayClose = () => {
    if (isPending) return;

    isDeleteOfferOverlayVisible.set(false);
  };

  const handleDeletePress = async () => {
    try {
      await deleteOffer(offer.id);
    } catch (e) {
      console.error(e);
    }
    handleOverlayClose();
    navigate({
      pathname: ROUTES.COLLECTIONS.BARTER,
      params: pageParams.barter,
    });
  };

  return (
    <Overlay
      overlayStyle={{
        width: "90%",
        backgroundColor: customTheme.colors.background,
      }}
      isVisible={isDeleteOfferOverlayVisible.value}
      onBackdropPress={handleOverlayClose}
    >
      <CustomText style={{ textAlign: "center", marginBottom: 10 }}>
        Are you sure, you want to delete this offer?
      </CustomText>
      <CustomButton
        title={"Delete"}
        loading={isPending}
        onPress={handleDeletePress}
      />
    </Overlay>
  );
}

export default DeleteOfferOverlay;
