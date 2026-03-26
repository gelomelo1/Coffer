import UserContactPlatfrom from "../helpers/user_contact_platform";

export interface UserContactRequired {
  userId: string;
  platform: UserContactPlatfrom;
  value: string;
  link?: string;
}

export interface UserContact extends UserContactRequired {
  id: string;
  createdAt: string;
  fullUrl?: string;
}
