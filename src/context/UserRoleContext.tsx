import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'operator' | 'developer';

interface UserRoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isRoleModalOpen: boolean;
  setIsRoleModalOpen: (open: boolean) => void;
  hasSeenOnboarding: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

const STORAGE_KEY = 'vampio_user_role';
const ONBOARDING_SEEN_KEY = 'vampio_role_onboarding_seen';

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clarified requirement: Show simplified (operator) mode by default
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'developer' || saved === 'operator') {
      return saved;
    }
    return 'operator'; // default simplified mode
  });

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(() => {
    // If first time visit, prompt role selection
    return localStorage.getItem(ONBOARDING_SEEN_KEY) !== 'true';
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setHasSeenOnboarding(true);
  };

  return (
    <UserRoleContext.Provider
      value={{
        role,
        setRole,
        isRoleModalOpen,
        setIsRoleModalOpen,
        hasSeenOnboarding,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
};

export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
