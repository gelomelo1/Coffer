import { UserContact } from "./user_contact";

export interface UserFrontend {
  country: string;
  summary?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  country: string;
  avatar: string;
  provider: string;
  summary?: string;
  contacts: UserContact[];
}

export default User;
