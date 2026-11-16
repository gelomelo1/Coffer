export type NavigationData = {
  data: string;
};

/**
 * Header texts carried in route params. `*Key` = i18n key for app text (translated when rendered, so a language
 * change applies everywhere); `title` / `screenTitle` = literal user content (usernames, collection or listing names).
 */
export interface NavigationParams {
  title?: string;
  titleKey?: string;
  screenTitle?: string;
  screenTitleKey?: string;
  isSettingsShown?: boolean;
}
