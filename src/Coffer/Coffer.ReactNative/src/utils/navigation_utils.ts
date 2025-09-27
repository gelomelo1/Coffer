import { ParamListBase, RouteProp } from "@react-navigation/native";
import { NavigationData, NavigationParams } from "../types/helpers/navigation";

export function buildNavigationData(params: NavigationParams): NavigationData {
  return { data: JSON.stringify(params) };
}

export function parseParams(
  route: RouteProp<ParamListBase, string>
): NavigationParams | undefined {
  try {
    const rawParams = route.params as { data?: string } | undefined;

    return rawParams?.data
      ? (JSON.parse(rawParams.data) as NavigationParams)
      : undefined;
  } catch (e) {
    console.warn("Failed to parse NavigationParams from route", e);
    return undefined;
  }
}
