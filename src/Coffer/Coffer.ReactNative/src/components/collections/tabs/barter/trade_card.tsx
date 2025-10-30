import CustomText from "@/src/components/custom_ui/custom_text";
import { Trade } from "@/src/types/entities/trade";
import { View } from "react-native";

interface TradeCardProps {
  trade: Trade;
}

function TradeCard({ trade }: TradeCardProps) {
  return (
    <View>
      <CustomText>{trade.title}</CustomText>
    </View>
  );
}

export default TradeCard;
