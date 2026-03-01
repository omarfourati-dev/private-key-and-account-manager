import React from 'react';
import { AuthContext, useAuthState } from './useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const authValue = useAuthState();

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}
