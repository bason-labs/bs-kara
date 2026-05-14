'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function adminSignOut() {
  await signOut(auth);
}
