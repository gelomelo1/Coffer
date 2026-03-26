import { UserContactRequired } from "../entities/user_contact";

export interface UserContactUpdate {
  id: string;
  value: UserContactRequired;
}

interface UserContactBulkPayload {
  created: UserContactRequired[];
  updated: UserContactUpdate[];
  deleted: string[];
}

export default UserContactBulkPayload;
