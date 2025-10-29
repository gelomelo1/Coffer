import { ContactType } from "../helpers/contact_type";

export interface UserContactRequired {
  userId: string;
  platform: ContactType;
  value: string;
  link?: string;
}

export interface UserContact extends UserContactRequired {
  id: string;
  createdAt: string;
}
