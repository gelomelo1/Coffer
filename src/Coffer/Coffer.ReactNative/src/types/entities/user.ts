export interface UserStore {
  user: User;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default User;
