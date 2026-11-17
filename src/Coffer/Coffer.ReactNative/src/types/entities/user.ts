
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
  /** 0 = user, 1 = moderator, 2 = admin */
  role?: number;
}

export default User;
