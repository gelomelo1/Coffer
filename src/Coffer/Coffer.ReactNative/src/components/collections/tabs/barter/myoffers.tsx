import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { OfferStatus } from "@/src/types/helpers/barter_status";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { Chip } from "react-native-elements";
import MyOfferCard from "./myoffer_card";

interface MyOffersProps {
  myOffersData: Offer[];
  isMyOffersFetching: boolean;
}

function MyOffers({ myOffersData, isMyOffersFetching }: MyOffersProps) {
  const { navigationMode } = useNavigationModeStore();
  const { collectionType } = useCollectionStore();

  const [selectedTradesData, setSelectedTradesData] = useState<
    "ongoing" | "ended"
  >("ongoing");

  const offerStatusOrder: OfferStatus[] = [
    "revertByOfferer",
    "revertByCreator",
    "accepted",
    "rejected",
    "pending",
  ];

  const ongoingOffersData = () =>
    myOffersData
      .filter((offer) => offer.status !== "traded")
      .sort((a, b) => {
        const aStatus = a.status;
        const bStatus = b.status;
        return (
          offerStatusOrder.indexOf(aStatus) - offerStatusOrder.indexOf(bStatus)
        );
      });

  const endedOffersData = () =>
    myOffersData.filter((offer) => offer.status === "traded");

  return (
    <View style={{ width: "100%" }}>
      <FlatList
        data={
          selectedTradesData === "ongoing"
            ? ongoingOffersData()
            : endedOffersData()
        }
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          width: "100%",
          paddingBottom: navigationMode.navigationBarHeight + 200,
        }}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 10 }}>
            <MyOfferCard offer={item} collectionType={collectionType} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <View
              style={{
                width: "100%",
                backgroundColor: customTheme.colors.background,
                marginHorizontal: 10,
              }}
            >
              <View
                style={{
                  justifyContent: "space-evenly",
                  alignItems: "center",
                  flexDirection: "row",
                }}
              >
                <Chip
                  key={`ongoing-${selectedTradesData}`}
                  title={"Ongoing"}
                  titleStyle={{ color: customTheme.colors.primary }}
                  buttonStyle={{
                    backgroundColor:
                      selectedTradesData === "ongoing"
                        ? customTheme.colors.secondary
                        : "transparent",
                  }}
                  onPress={() => setSelectedTradesData("ongoing")}
                />
                <Chip
                  key={`ended-${selectedTradesData}`}
                  title={"Ended"}
                  titleStyle={{ color: customTheme.colors.primary }}
                  buttonStyle={{
                    backgroundColor:
                      selectedTradesData === "ended"
                        ? customTheme.colors.secondary
                        : "transparent",
                  }}
                  onPress={() => setSelectedTradesData("ended")}
                />
              </View>
              <CustomText style={{ fontSize: 18, marginBottom: 5 }}>
                {selectedTradesData === "ongoing"
                  ? `${ongoingOffersData().length} active offers`
                  : `${endedOffersData().length} ended offers`}
              </CustomText>
            </View>
            {isMyOffersFetching ? <Loading /> : null}
          </>
        }
        stickyHeaderIndices={[0]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          <CustomText
            style={{
              textAlign: "center",
              fontFamily: "VendSansItalic",
              marginTop: 20,
            }}
          >
            End of results
          </CustomText>
        }
      />
    </View>
  );
}

export default MyOffers;
