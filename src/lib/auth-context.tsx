import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { serverTimestamp, doc, getDoc, setDoc, query, collection, limit, getDocs, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getDeviceId } from './device';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDeviceAuthorized: boolean;
  isProfileComplete: boolean;
  isApproved: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isDeviceAuthorized: true,
  isProfileComplete: true,
  isApproved: true,
  refreshProfile: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [isApproved, setIsApproved] = useState(true);

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Request Timeout')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  };

  const checkProfile = async (currentUser: User) => {
    const currentDeviceId = getDeviceId();
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await withTimeout(getDoc(userDocRef));

    let userProfile: any = null;

    if (userDoc.exists()) {
      userProfile = userDoc.data();
      // FORCE SUPER ADMIN STATUS UPDATE IN FIRESTORE DOCUMENT
      const isOwner = currentUser.email === 'aliefneutron@gmail.com' || currentUser.email === 'aliefcorp.app@gmail.com';
      if (isOwner && userProfile.role !== 'admin') {
        userProfile.role = 'admin';
        await withTimeout(setDoc(userDocRef, { role: 'admin' }, { merge: true }));
      }
    } else {
      // Check if a profile with this email was pre-registered (case-insensitive)
      const emailLower = (currentUser.email || '').toLowerCase().trim();
      console.log('[Auth] No doc found for UID, searching by email:', emailLower);
      const q = query(collection(db, 'users'), where('email', '==', emailLower));
      const emailSnap = await withTimeout(getDocs(q));

      if (!emailSnap.empty) {
        console.log('[Auth] Found pre-registered doc(s):', emailSnap.docs.map(d => d.id));
        // Use the first found doc's data as the source of truth
        const existingDoc = emailSnap.docs[0];
        const existingData = existingDoc.data();
        userProfile = {
          status: 'approved', // Default to approved for pre-registered users
          ...existingData,
          uid: currentUser.uid,
          email: emailLower,
          displayName: currentUser.displayName || existingData.displayName || existingData.name,
          updatedAt: serverTimestamp(),
        };
        await withTimeout(setDoc(userDocRef, userProfile));
        console.log('[Auth] Merged pre-registered data into UID doc:', currentUser.uid);

        // Delete ALL pre-registered/duplicate documents to prevent duplicates
        const toDelete = emailSnap.docs.filter(d => d.id !== currentUser.uid);
        if (toDelete.length > 0) {
          console.log('[Auth] Deleting', toDelete.length, 'pre-registered/duplicate doc(s)...');
          const deletePromises = toDelete.map(d =>
            withTimeout(deleteDoc(doc(db, 'users', d.id))).then(() => {
              console.log('[Auth] Deleted duplicate doc:', d.id);
            }).catch(e => console.warn('[Auth] Could not delete duplicate doc:', d.id, '→', e?.message))
          );
          await Promise.all(deletePromises);
        }
      } else {
        const usersSnap = await withTimeout(getDocs(query(collection(db, 'users'), limit(1))));
        const isFirstUser = usersSnap.empty;
        const isOwner = currentUser.email === 'aliefneutron@gmail.com' || currentUser.email === 'aliefcorp.app@gmail.com';

        userProfile = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          role: (isFirstUser || isOwner) ? 'admin' : 'staff',
          status: (isFirstUser || isOwner) ? 'approved' : 'pending',
          createdAt: serverTimestamp(),
        };
        await withTimeout(setDoc(userDocRef, userProfile));
      }
    }

    // Device Lock Logic
    if (userProfile && userProfile.role !== 'admin') {
      if (!userProfile.deviceId) {
        // First time login - register device
        await withTimeout(setDoc(userDocRef, { deviceId: currentDeviceId }, { merge: true }));
        userProfile.deviceId = currentDeviceId;
      } else if (userProfile.deviceId !== currentDeviceId) {
        // Mismatch
        setIsDeviceAuthorized(false);
      }
    }

    // Profile Completion Logic
    if (userProfile && userProfile.role !== 'admin') {
      // Jika sudah di-approve oleh admin, anggap profil komplit (skip isi profil)
      // Jika masih pending, wajib isi nip & bidang
      const isComplete = userProfile.status !== 'pending' || !!(userProfile.nip && userProfile.bidang);
      setIsProfileComplete(isComplete);
    } else {
      setIsProfileComplete(true);
    }

    // Approval Status Logic
    if (userProfile) {
      const approved = userProfile.status !== 'pending' && userProfile.status !== 'rejected';
      setIsApproved(approved);
    } else {
      setIsApproved(true);
    }

    setProfile(userProfile);
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        await checkProfile(user);
      } catch (err) {
        console.error("Refresh profile error:", err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      try {
        if (currentUser) {
          setIsDeviceAuthorized(true);
          await checkProfile(currentUser);
        } else {
          setProfile(null);
          setIsDeviceAuthorized(true);
          setIsProfileComplete(true);
          setIsApproved(true);
        }
      } catch (error) {
        console.error("Error during auth state change:", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email === 'aliefneutron@gmail.com' || user?.email === 'aliefcorp.app@gmail.com';
  const isSuperAdmin = user?.email === 'aliefneutron@gmail.com' || user?.email === 'aliefcorp.app@gmail.com';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, isDeviceAuthorized, isProfileComplete, isApproved, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
