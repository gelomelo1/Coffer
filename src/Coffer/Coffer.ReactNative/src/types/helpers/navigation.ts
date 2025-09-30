export type NavigationData = {
  data: string;
};

export interface NavigationParams {
  title: string;
  description?: {
    icon?: string;
    title: string;
    color?: string;
    additionalHeadings: string[];
  };
  isSettingsShown?: boolean;
}
