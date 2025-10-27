import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  ApplicationVerifier
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  pushToken?: string;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<string>;
  confirmPhoneVerification: (verificationId: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook<AuthContextType>(() => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restoreUser = async () => {
      setLoading(true);
      try {
        const storedUser = await AsyncStorage.getItem('adminUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('[AuthContext] Error restoring user from storage:', err);
      }
      setLoading(false);
    };
    restoreUser();

    console.log('[AuthContext] Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('[AuthContext] Auth state changed:', firebaseUser?.email);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          const userData = userDoc.data();
          if (userData && userData.isAdmin === true) {
            console.log('[AuthContext] Admin user verified');
            const adminUser: AdminUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || userData.displayName,
              isAdmin: true,
              pushToken: userData.pushToken,
            };
            setUser(adminUser);
            await AsyncStorage.setItem('adminUser', JSON.stringify(adminUser));
          } else {
            console.log('[AuthContext] User is not an admin');
            setError('غير مصرح لك بالدخول - Unauthorized access');
            await firebaseSignOut(auth);
            setUser(null);
            await AsyncStorage.removeItem('adminUser');
          }
        } catch (err) {
          console.error('[AuthContext] Error fetching user data:', err);
          setError('حدث خطأ في التحقق من الصلاحيات - Error verifying permissions');
          setUser(null);
          await AsyncStorage.removeItem('adminUser');
        }
      } else {
        console.log('[AuthContext] No user signed in');
        setUser(null);
        await AsyncStorage.removeItem('adminUser');
      }
      setLoading(false);
    });
    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] Attempting sign in for:', email);
    setError(null);
    setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AuthContext] Sign in successful:', userCredential.user.email);
      
      const userDoc = await getDoc(doc(db, 'admins', userCredential.user.uid));
      const userData = userDoc.data();
      
      if (!userData || userData.isAdmin !== true) {
        console.log('[AuthContext] User is not an admin, signing out');
        await firebaseSignOut(auth);
        throw new Error('غير مصرح لك بالدخول - Unauthorized access');
      }
    } catch (err: any) {
      console.error('[AuthContext] Sign in error:', err);
      const errorMessage = err.code === 'auth/invalid-credential' 
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة - Invalid email or password'
        : err.message || 'حدث خطأ في تسجيل الدخول - Sign in error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AuthContext] Signing out');
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      await AsyncStorage.removeItem('adminUser');
      console.log('[AuthContext] Sign out successful');
    } catch (err: any) {
      console.error('[AuthContext] Sign out error:', err);
      setError(err.message || 'حدث خطأ في تسجيل الخروج - Sign out error');
      throw err;
    }
  }, []);

  const signInWithPhone = useCallback(async (phoneNumber: string): Promise<string> => {
    console.log('[AuthContext] Attempting phone sign in for:', phoneNumber);
    setError(null);
    
    try {
      if (typeof window === 'undefined') {
        throw new Error('Phone authentication is not supported in this environment');
      }

      let recaptchaVerifier: ApplicationVerifier;
      
      if (!(window as any).recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        (window as any).recaptchaVerifier = recaptchaVerifier;
      } else {
        recaptchaVerifier = (window as any).recaptchaVerifier;
      }

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      console.log('[AuthContext] Verification code sent');
      return confirmationResult.verificationId;
    } catch (err: any) {
      console.error('[AuthContext] Phone sign in error:', err);
      const errorMessage = err.message || 'حدث خطأ في إرسال رمز التحقق - Error sending verification code';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const confirmPhoneVerification = useCallback(async (verificationId: string, code: string) => {
    console.log('[AuthContext] Confirming phone verification');
    setError(null);
    setLoading(true);
    
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await signInWithCredential(auth, credential);
      console.log('[AuthContext] Phone verification successful:', userCredential.user.uid);
      
      const userDoc = await getDoc(doc(db, 'admins', userCredential.user.uid));
      const userData = userDoc.data();
      
      if (!userData || userData.isAdmin !== true) {
        console.log('[AuthContext] User is not an admin, signing out');
        await firebaseSignOut(auth);
        throw new Error('غير مصرح لك بالدخول - Unauthorized access');
      }
    } catch (err: any) {
      console.error('[AuthContext] Phone verification error:', err);
      const errorMessage = err.code === 'auth/invalid-verification-code'
        ? 'رمز التحقق غير صحيح - Invalid verification code'
        : err.message || 'حدث خطأ في التحقق - Verification error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);



  const isAdmin = useMemo(() => {
    return user?.isAdmin === true;
  }, [user]);

  return useMemo(() => ({
    user,
    loading,
    error,
    isAdmin,
    signIn,
    signInWithPhone,
    confirmPhoneVerification,
    signOut,
  }), [user, loading, error, isAdmin, signIn, signInWithPhone, confirmPhoneVerification, signOut]);
});
