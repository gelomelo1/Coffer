import { useUserStore } from "@/src/hooks/user_store";
import { useState } from "react";
import {
  Image,
  ImageStyle,
  Modal,
  StyleProp,
  Text,
  TouchableOpacity,
} from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView } from "react-native-safe-area-context";

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
      <TouchableOpacity onPress={() => setIsModalVisible(true)}>
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
              <SafeAreaView
                style={{
                  position: "absolute",
                  top: 0,
                  right: 10,
                  zIndex: 9999,
                }}
              >
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 24,
                      fontWeight: "bold",
                    }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </SafeAreaView>
            )}
          />
        </Modal>
      ) : null}
    </>
  );
}

export default CustomImage;
