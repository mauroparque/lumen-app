import React, { createContext, useContext, useMemo } from 'react';
import { User } from 'firebase/auth';
import { IDataService } from '../services/IDataService';
import { FirebaseService } from '../services/FirebaseService';
import { MockService } from '../services/MockService';

const ServiceContext = createContext<IDataService | null>(null);

export const useService = () => {
    return useContext(ServiceContext);
};

interface ServiceProviderProps {
    user: User | null;
    children: React.ReactNode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ user, children }) => {
    const service = useMemo(() => {
        if (!user) return null;

        if (user.uid === 'demo-user') {
            return new MockService();
        }

        return new FirebaseService(user.uid);
    }, [user?.uid]);

    if (!user || !service) {
        return <>{children}</>;
    }

    return (
        <ServiceContext.Provider value={service}>
            {children}
        </ServiceContext.Provider>
    );
};
