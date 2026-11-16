import { useUserStore } from "@/src/hooks/user_store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, ImageStyle, Modal, StyleProp, TouchableOpacity, View } from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CustomImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  enableFullScreenView?: boolean;
}

function CustomImage({
  uri,
  style,
  enableFullScreenView = false,
}: CustomImageProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useUserStore();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const images = [
    {
      url: uri,

      props: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  ];

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        disabled={!enableFullScreenView}
        accessibilityRole={enableFullScreenView ? "imagebutton" : "image"}
        accessibilityLabel={enableFullScreenView ? t("common:image.openFullScreen") : undefined}
        activeOpacity={0.85}
      >
        <Image
          source={{
            uri: uri,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "reload",
          }}
          style={style}
        />
      </TouchableOpacity>
      {enableFullScreenView ? (
        <Modal
          visible={isModalVisible}
          transparent
          onRequestClose={() => setIsModalVisible(false)}
        >
          <ImageViewer
            imageUrls={images}
            onCancel={() => setIsModalVisible(false)}
            saveToLocalByLongPress={false}
            enableSwipeDown
            renderHeader={() => (
              <View style={{ position: "absolute", top: insets.top + 8, right: 8, zIndex: 9999 }}>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("accessibility:close")}
                  style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                  <MaterialIcons name="close" size={28} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          />
        </Modal>
      ) : null}
    </>
  );
}

export default CustomImage;
