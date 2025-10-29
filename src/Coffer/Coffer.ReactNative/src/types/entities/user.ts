import { UserContact } from "./user_contact";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  country: string;
  avatar: string;
  provider: string;
  contacts: UserContact[];
}

export default User;
