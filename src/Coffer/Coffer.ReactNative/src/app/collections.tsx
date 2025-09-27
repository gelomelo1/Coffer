import { useState } from "react";
import { ScrollView } from "react-native";
import { Icon } from "react-native-elements";
import CollectionsContainer from "../components/collections/collections_container";
import CreateCollectionForm from "../components/collections/create_collection_form";
import CustomButton from "../components/custom_ui/custom_button";
import { Loading } from "../components/custom_ui/loading";
import { endpoints } from "../const/endpoints";
import { querykeys } from "../const/querykeys";
import { useGetData } from "../hooks/data_hooks";
import { useUserStore } from "../hooks/user_store";
import { customTheme } from "../theme/theme";
import { Collection } from "../types/entities/collection";
import CollectionType from "../types/entities/collectiontype";

function Collections() {
  const { user } = useUserStore();

  const [
    isCreateNewCollectionOverlayOpen,
    setIsCreateNewCollectionOverlayOpen,
  ] = useState(false);

  const { data: collectionTypes = [], isFetching: isCollectionTypesFetching } =
    useGetData<CollectionType>(
      endpoints.collectionTypes,
      querykeys.collectionTypesData
    );

  const { data: collections = [], isFetching: isCollectionsFetching } =
    useGetData<Collection>(endpoints.collections, querykeys.collectionsData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user.id,
        },
      ],
    });

  const loading = isCollectionTypesFetching || isCollectionsFetching;

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: customTheme.colors.background,
          borderWidth: 2,
          borderColor: customTheme.colors.primary,
        }}
      >
        <CustomButton
          title="Create new collection"
          icon={
            <Icon name="add" color={customTheme.colors.secondary} size={32} />
          }
          onPress={() => setIsCreateNewCollectionOverlayOpen(true)}
          containerStyle={{
            marginBottom: 10,
            padding: 10,
          }}
          disabled={isCollectionTypesFetching}
        />
        {loading ? (
          <Loading />
        ) : (
          <CollectionsContainer
            collectionTypes={collectionTypes}
            collections={collections}
          />
        )}
      </ScrollView>
      <CreateCollectionForm
        isCreateNewCollectionOverlayOpen={{
          value: isCreateNewCollectionOverlayOpen,
          set: setIsCreateNewCollectionOverlayOpen,
        }}
        collectionTypes={collectionTypes}
        user={user}
      />
    </>
  );
}

export default Collections;
