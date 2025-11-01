import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import { customTheme } from "@/src/theme/theme";
import { Trade } from "@/src/types/entities/trade";
import React from "react";
import { Overlay } from "react-native-elements";

interface DeleteTradeOverlayProps {
  trade: Trade;
  isDeleteTradeOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function DeleteTradeOverlay({
  trade,
  isDeleteTradeOverlayVisible,
}: DeleteTradeOverlayProps) {
  const navigate = useResetNavigation();
  const { mutateAsync: deleteTrade, isPending } = useDeleteData(
    endpoints.trades,
    querykeys.myTradesData
  );

  const handleOverlayClose = () => {
    if (isPending) return;

    isDeleteTradeOverlayVisible.set(false);
  };

  const handleDeletePress = async () => {
    try {
      await deleteTrade(trade.id);
    } catch (e) {
      console.log(e);
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
      isVisible={isDeleteTradeOverlayVisible.value}
      onBackdropPress={handleOverlayClose}
    >
      <CustomText style={{ textAlign: "center", marginBottom: 10 }}>
        Are you sure, you want to delete this trade?
      </CustomText>
      <CustomButton
        title={"Delete"}
        loading={isPending}
        onPress={handleDeletePress}
      />
    </Overlay>
  );
}

export default DeleteTradeOverlay;
