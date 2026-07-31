import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, Analytics, logEvent as firebaseLogEvent } from "firebase/analytics";
import { getFirestore, doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  sendEmailVerification,
  GoogleAuthProvider, 
  signInWithPopup, 
  User 
} from "firebase/auth";
import { generateOrderId } from "./orderIds";

// Firebase configuration provided for tracking, database & authentication
const firebaseConfig = {
  apiKey: "AIzaSyC_bTPNEGLrfOgHs4GulA3BAn5yuLe90So",
  authDomain: "digivisa.firebaseapp.com",
  projectId: "digivisa",
  storageBucket: "digivisa.firebasestorage.app",
  messagingSenderId: "736357092598",
  appId: "1:736357092598:web:6981d619d2a2d7192db0d7",
  measurementId: "G-GS29TJWQQF"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore Database & Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Analytics instance reference
export let analytics: Analytics | null = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("[Firebase] Analytics initialized successfully.");
    }
  }).catch((error) => {
    console.error("[Firebase] Error checking Analytics support:", error);
  });
}

/**
 * Log custom tracking events to Firebase Analytics.
 */
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (analytics) {
    firebaseLogEvent(analytics, eventName, eventParams);
  }
};

/**
 * Register a new user with Email and Password & Send Email Verification
 * Immediately signs out unverified user until they click email activation link.
 */
export const registerUser = async (email: string, password: string): Promise<{ user?: User; verificationSent?: boolean; error?: string }> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    let verificationSent = false;
    if (userCredential.user) {
      try {
        await sendEmailVerification(userCredential.user);
        verificationSent = true;
      } catch (e) {
        console.error("Failed to send verification email:", e);
      }
      // Sign out immediately so user cannot log in without clicking email activation link
      await firebaseSignOut(auth);
    }
    return { user: userCredential.user, verificationSent };
  } catch (error: any) {
    return { error: error.message || "Registration failed" };
  }
};

/**
 * Resend email verification to current user
 */
export const sendVerificationEmailToCurrentUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      return { success: true };
    }
    return { success: false, error: "No active user session" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign in an existing user with Email and Password.
 * STRICT: Enforces email activation (emailVerified === true).
 */
export const loginUser = async (email: string, password: string): Promise<{ user?: User; unverified?: boolean; error?: string }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Reload user to get fresh emailVerified status from Firebase Auth
    await user.reload();
    
    if (!user.emailVerified) {
      // Re-send verification email if not verified
      try {
        await sendEmailVerification(user);
      } catch (e) {
        console.error("Error resending verification email on login attempt:", e);
      }
      // Sign out immediately
      await firebaseSignOut(auth);
      return { unverified: true, user, error: "email-not-verified" };
    }
    
    return { user };
  } catch (error: any) {
    return { error: error.message || "Login failed" };
  }
};

/**
 * Sign out current user
 */
export const logoutUser = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export { onAuthStateChanged };

/**
 * Save an order to Firebase Firestore collection 'orders'
 */
export const saveOrderToFirestore = async (order: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const orderId = order.id || generateOrderId();
    const orderRef = doc(collection(db, "orders"), orderId);
    
    // Clean data to avoid undefined values which Firestore rejects
    const cleanData = JSON.parse(JSON.stringify(order));
    
    await setDoc(orderRef, {
      ...cleanData,
      updatedAt: new Date().toISOString()
    });
    console.log("[Firebase Firestore] Order saved successfully to collection 'orders':", orderId);
    return { success: true };
  } catch (error: any) {
    console.error("[Firebase Firestore] Error saving order to Firestore:", error);
    return { 
      success: false, 
      error: error?.message || error?.code || "Unknown Firebase error" 
    };
  }
};

/**
 * Fetch orders for the signed-in owner (rules: userId == auth.uid).
 * Email-based queries are not allowed by security rules.
 */
export const fetchOrdersForUser = async (userId: string, _email?: string): Promise<any[]> => {
  try {
    if (!userId) return [];
    const q1 = query(collection(db, "orders"), where("userId", "==", userId));
    const querySnapshot1 = await getDocs(q1);
    const orders: any[] = [];
    querySnapshot1.forEach((d) => {
      orders.push(d.data());
    });
    return orders;
  } catch (error) {
    console.error("[Firebase Firestore] Error fetching user orders:", error);
    return [];
  }
};

/**
 * Fetch all orders for OMS — requires Firebase Auth custom claim staff:true.
 */
export const fetchAllOrdersFromFirestore = async (): Promise<any[]> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error("[Firebase Firestore] fetchAllOrders requires signed-in staff");
      return [];
    }
    const token = await user.getIdTokenResult();
    if (token.claims.staff !== true) {
      console.error("[Firebase Firestore] fetchAllOrders denied — missing staff claim");
      return [];
    }
    const querySnapshot = await getDocs(collection(db, "orders"));
    const orders: any[] = [];
    querySnapshot.forEach((d) => {
      orders.push(d.data());
    });
    return orders;
  } catch (error) {
    console.error("[Firebase Firestore] Error fetching all orders:", error);
    return [];
  }
};

/** True when the current Firebase user has custom claim staff:true. */
export const currentUserHasStaffClaim = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult(true);
  return token.claims.staff === true;
};
