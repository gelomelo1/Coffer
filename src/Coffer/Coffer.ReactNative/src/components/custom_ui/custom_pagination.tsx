import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

export interface CustomPaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage?: number; // allow undefined
  onPageChange: (page: number) => void;
  pagesToDisplay?: number;
  containerStyle?: StyleProp<ViewStyle>;
  btnStyle?: StyleProp<ViewStyle> | ((page: number) => StyleProp<ViewStyle>);
  textStyle?: StyleProp<TextStyle> | ((page: number) => StyleProp<TextStyle>);
  activeBtnStyle?: StyleProp<ViewStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  pageChangeBtnStyle?: StyleProp<ViewStyle>;
  pageChangeTextStyle?: StyleProp<TextStyle>;
  allowOverPrev?: boolean; // allow going below min
  allowOverNext?: boolean; // allow going above max
}

const CustomPagination: React.FC<CustomPaginationProps> = ({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  pagesToDisplay = 3,
  containerStyle,
  btnStyle,
  textStyle,
  activeBtnStyle,
  activeTextStyle,
  pageChangeBtnStyle,
  pageChangeTextStyle,
  allowOverPrev = false,
  allowOverNext = false,
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  const getButtonStyle = (page: number) =>
    typeof btnStyle === "function" ? btnStyle(page) : btnStyle;

  const getTextStyle = (page: number) =>
    typeof textStyle === "function" ? textStyle(page) : textStyle;

  const getVisiblePages = (): (number | string)[] => {
    if (totalPages === 0) return [];
    const pages: (number | string)[] = [];
    const half = Math.floor(pagesToDisplay / 2);

    let start = currentPage ? Math.max(1, currentPage - half) : 1;
    let end = currentPage
      ? Math.min(totalPages, currentPage + half)
      : Math.min(totalPages, pagesToDisplay);

    if (end - start + 1 < pagesToDisplay) {
      if (start === 1) end = Math.min(totalPages, start + pagesToDisplay - 1);
      else if (end === totalPages)
        start = Math.max(1, end - pagesToDisplay + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getVisiblePages();

  const handlePrev = () => {
    if (!currentPage) return;
    if (currentPage > 1) onPageChange(currentPage - 1);
    else if (allowOverPrev) onPageChange(currentPage - 1); // can send 0 or negative
  };

  const handleNext = () => {
    if (!currentPage) return;
    if (currentPage < totalPages) onPageChange(currentPage + 1);
    else if (allowOverNext) onPageChange(currentPage + 1); // can send totalPages+1
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Previous button */}
      <TouchableOpacity
        disabled={!currentPage || (!allowOverPrev && currentPage === 1)}
        onPress={handlePrev}
        style={[
          styles.button,
          pageChangeBtnStyle,
          (!currentPage || (!allowOverPrev && currentPage === 1)) &&
            styles.disabledButton,
        ]}
      >
        <Text style={[styles.text, pageChangeTextStyle]}>{"<"}</Text>
      </TouchableOpacity>

      {/* Page buttons */}
      {pages.map((p, index) =>
        p === "..." ? (
          <Text
            key={`dots-${index}`}
            style={[
              styles.ellipsis,
              styles.text,
              typeof textStyle === "function" ? undefined : textStyle,
            ]}
          >
            ...
          </Text>
        ) : (
          <TouchableOpacity
            key={p}
            onPress={() => onPageChange(p as number)}
            style={[
              styles.button,
              getButtonStyle(p as number),
              p === currentPage && activeBtnStyle,
            ]}
          >
            <Text
              style={[
                styles.text,
                getTextStyle(p as number),
                p === currentPage && activeTextStyle,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Next button */}
      <TouchableOpacity
        disabled={
          !currentPage || (!allowOverNext && currentPage === totalPages)
        }
        onPress={handleNext}
        style={[
          styles.button,
          pageChangeBtnStyle,
          (!currentPage || (!allowOverNext && currentPage === totalPages)) &&
            styles.disabledButton,
        ]}
      >
        <Text style={[styles.text, pageChangeTextStyle]}>{">"}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CustomPagination;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  button: {
    marginHorizontal: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "#ccc",
  },
  text: {
    color: "#000",
    fontSize: 14,
  },
  ellipsis: {
    marginHorizontal: 5,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
