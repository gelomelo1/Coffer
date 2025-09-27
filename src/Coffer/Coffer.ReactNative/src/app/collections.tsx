import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "expo-router/build/hooks";
import { useState } from "react";
import { View } from "react-native";
import { Icon } from "react-native-elements";
import CollectionsContainer from "../components/collections/collections_container";
import CreateCollectionForm from "../components/collections/create_collection_form";
import CustomButton from "../components/custom_ui/custom_button";
import { Loading } from "../components/custom_ui/loading";
import { endpoints } from "../const/endpoints";
import { customTheme } from "../theme/theme";
import { Collection } from "../types/entities/collection";
import CollectionType from "../types/entities/collectiontype";
import User from "../types/entities/user";
import { getData } from "../utils/backend_access";
import buildQuery from "../utils/query_builder";

function Collections() {
  const params = useSearchParams();
  let user: User | undefined = undefined;

  if (params.get("user") !== null) {
    try {
      user = JSON.parse(params.get("user") as string) as User;
    } catch (e) {
      console.warn("Failed to parse user from params", e);
    }
  }

  const [
    isCreateNewCollectionOverlayOpen,
    setIsCreateNewCollectionOverlayOpen,
  ] = useState(false);

  const { data: collectionTypes = [], isFetching: isCollectionTypesFetching } =
    useQuery({
      queryKey: ["collectionTypesData"],
      queryFn: () => {
        return getData<CollectionType>(endpoints.collectionTypes);
      },
    });

  const { data: collections = [], isFetching: isCollectionsFetching } =
    useQuery({
      queryKey: ["collectionsData"],
      queryFn: () => {
        return getData<Collection>(
          `${endpoints.collections}/${buildQuery<Collection>({
            filters: [
              {
                filter: "Match",
                field: "userId",
                value: user?.id ?? "",
              },
            ],
          })}`
        );
      },
    });

  const loading = isCollectionTypesFetching || isCollectionsFetching;

  return (
    <>
      <View
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
      </View>
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
