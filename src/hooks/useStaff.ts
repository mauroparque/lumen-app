import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { StaffProfile } from '../types';

export const useStaff = (user: User | null) => {
    const [profile, setProfile] = useState<StaffProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onSnapshot(
            doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'staff', user.uid),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setProfile(docSnapshot.data() as StaffProfile);
                } else {
                    setProfile(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching staff profile:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [user]);

    const createProfile = async (data: { name: string; specialty?: string }) => {
        if (!user) return;

        const newProfile: StaffProfile = {
            uid: user.uid,
            email: user.email || '',
            name: data.name,
            role: 'professional', // Default role
            specialty: data.specialty,
            createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'staff', user.uid), newProfile);
    };

    const updateProfile = async (data: Partial<StaffProfile>) => {
        if (!user) return;
        await setDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'staff', user.uid), data, { merge: true });
    };

    return { profile, loading, createProfile, updateProfile };
};
