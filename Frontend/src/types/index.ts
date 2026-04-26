export type UserRole = 'admin' | 'user';

export type UserProfile = {
  id: string;
  role: UserRole;
  email: string;
  name?: string;
};

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  AdminDashboard: undefined;
  UserDashboard: undefined;
};
