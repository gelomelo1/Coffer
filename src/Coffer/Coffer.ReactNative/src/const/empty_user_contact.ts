import { UserContact } from "../types/entities/user_contact";
import UserContactPlatfrom from "../types/helpers/user_contact_platform";

const emptyUserContact = (
  id: string,
  userId: string,
  platform: UserContactPlatfrom,
): UserContact => ({
  id,
  createdAt: "",
  userId: userId,
  platform: platform,
  value: "",
  link: "",
});

export default emptyUserContact;
