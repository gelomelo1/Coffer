import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { offerStatusRecord } from "@/src/const/trade_status";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import { useOfferStore } from "@/src/hooks/offer_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { navigate } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import BarterMozaicGallery from "./barter_mozaic_gallery";

interface MyOfferCardProps {
  offer: Offer;
  collectionType: CollectionType;
}

function MyOfferCard({ offer, collectionType }: MyOfferCardProps) {
  const { setOffer } = useOfferStore();
  const { setTrade } = useTradeStore();

  const { data: tradeData, isPending } = useGetSingleData<Trade>(
    endpoints.trades,
    querykeys.tradeData,
    offer.tradeId
  );

  const handleOfferDetailsPress = () => {
    if (tradeData) {
      setOffer(offer);
      setTrade(tradeData);

      navigate({
        pathname: ROUTES.OFFERDETAILS,
        params: pageParams.offerDetails("My offer"),
      });
    }
  };

  const offerStatus = offerStatusRecord[offer.status];

  return (
    <View
      style={{
        width: "100%",
        alignItems: "flex-start",
        borderBottomWidth: 2,
        borderBottomColor: customTheme.colors.primary,
        borderRadius: 10,
      }}
    >
      <CustomText style={{ fontSize: 20 }}>Belong to trade:</CustomText>
      <CustomText
        style={{
          fontFamily: "VendSansBold",
        }}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {tradeData ? tradeData.title : ""}
      </CustomText>
      <BarterMozaicGallery
        collectionType={collectionType}
        items={offer.offerItems}
      />

      {offer.moneyOffer ? (
        <View
          style={{
            width: "100%",
            backgroundColor: customTheme.colors.primary,
            borderRadius: 50,
            marginTop: 10,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 5,
          }}
        >
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              color: customTheme.colors.secondary,
            }}
          >
            {offer.moneyOffer}
          </CustomText>
          <FontAwesome
            name="euro"
            size={16}
            color={customTheme.colors.secondary}
          />
        </View>
      ) : null}

      <CustomText>
        Status:{" "}
        <CustomText style={{ color: offerStatus.color }}>
          {offerStatus.label}
        </CustomText>
      </CustomText>
      <CustomText>
        Created At: {new Date(offer.createdAt).toLocaleDateString()}
      </CustomText>
      <TouchableOpacity
        style={{ width: "100%" }}
        onPress={handleOfferDetailsPress}
        disabled={isPending}
      >
        <CustomText
          style={{
            textAlign: "center",
            color: customTheme.colors.secondary,
            fontSize: 24,
            textDecorationLine: "underline",
          }}
        >
          Details
        </CustomText>
      </TouchableOpacity>
    </View>
  );
}

export default MyOfferCard;
