import { backendAxios } from "./backendAccessConfiguration";

export const endpoints = {
  googleValidate: "api/auth/google/validate",
  googleRegister: "api/auth/google/register",
  githubValidate: "api/auth/github/validate",
  githubRegister: "api/auth/github/register",
  currentUser: "api/auth/currentUser",
  users: "api/Users",
  collectionTypes: "api/CollectionTypes",
  collections: "api/Collections",
  icons: `${backendAxios.defaults.baseURL}/icons`,
};
