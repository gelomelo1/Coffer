import CollectionsContainer from "@/src/components/collections/collections_container";
import CreateCollectionForm from "@/src/components/collections/create_collection_form";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { useState } from "react";
import { View } from "react-native";
import { Icon } from "react-native-elements";

function Collections() {
  const { user } = useUserStore();
  const { collectionTypes } = useCollectionTypeStore();

  const [
    isCreateNewCollectionOverlayOpen,
    setIsCreateNewCollectionOverlayOpen,
  ] = useState(false);

  const { data: collections = [], isFetching: isCollectionsFetching } =
    useGetData<Collection>(endpoints.collections, querykeys.collectionsData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
        },
      ],
    });

  const loading = isCollectionsFetching;

  return (
    <>
      <View style={rootViewStyle()}>
        <CustomButton
          title="Create new collection"
          icon={
            <Icon name="add" color={customTheme.colors.secondary} size={32} />
          }
          onPress={() => setIsCreateNewCollectionOverlayOpen(true)}
          containerStyle={{
            marginVertical: 10,
            marginHorizontal: 10,
          }}
        />
        {loading ? (
          <Loading />
        ) : (
          <CollectionsContainer
            collectionTypes={collectionTypes}
            collections={collections}
          />
        )}
      </View>
      <CreateCollectionForm
        isCreateNewCollectionOverlayOpen={{
          value: isCreateNewCollectionOverlayOpen,
          set: setIsCreateNewCollectionOverlayOpen,
        }}
        collectionTypes={collectionTypes}
        user={user!}
      />
    </>
  );
}

export default Collections;
