import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('milkAppUser');
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                // Sanity check: userType must be a string
                if (typeof parsed.userType === 'string') {
                    return parsed;
                }
                console.warn("Found corrupted user state (userType not string), resetting.");
                localStorage.removeItem('milkAppUser');
                return null;
            } catch (e) {
                localStorage.removeItem('milkAppUser');
                return null;
            }
        }
        return null;
    });
    const [loading, setLoading] = useState(false);

    const login = (userType, userData = {}) => {
        const newUser = { userType, ...userData };
        setUser(newUser);
        localStorage.setItem('milkAppUser', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('milkAppUser');
        window.location.href = '/';
    };

    return (
        <UserContext.Provider value={{
            user,
            userType: user?.userType,
            login,
            logout,
            loading,
            isOwner: user?.userType === 'owner',
            isMember: user?.userType === 'member',
            isFarmer: user?.userType === 'farmer'
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
