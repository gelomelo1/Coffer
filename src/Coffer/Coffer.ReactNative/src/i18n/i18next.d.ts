import "i18next";
import { en } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    nsSeparator: ":";
    keySeparator: ".";
    returnNull: false;
    resources: typeof en;
  }
}
