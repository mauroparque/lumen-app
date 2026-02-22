import React, { createContext, useContext, useMemo } from 'react';
import { User } from 'firebase/auth';
import { IDataService } from '../services/IDataService';
import { FirebaseService } from '../services/FirebaseService';
import { StaffProfile } from '../types';

const ServiceContext = createContext<IDataService | null>(null);

export const useService = () => {
    return useContext(ServiceContext);
};

interface ServiceProviderProps {
    user: User | null;
    profile: StaffProfile | null;
    children: React.ReactNode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ user, profile, children }) => {
    const service = useMemo(() => {
        if (!user) return null;
        // Pass professional name for query filtering
        const professionalName = profile?.name || user.displayName || undefined;
        return new FirebaseService(user.uid, professionalName);
    }, [user?.uid, profile?.name, user?.displayName]);

    if (!user || !service) {
        return <>{children}</>;
    }

    return <ServiceContext.Provider value={service}>{children}</ServiceContext.Provider>;
};
