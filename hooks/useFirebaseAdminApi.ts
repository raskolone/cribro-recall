import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export function useFirebaseAdminApi() {
  const { user } = useAuth();

  const getIdToken = async () => {
    if (!auth || !auth.currentUser) throw new Error('Not authenticated');
    return await auth.currentUser.getIdToken();
  };

  const listUsers = async () => {
    const token = await getIdToken();
    const res = await fetch('/api/firebase-admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const createUser = async (email: string, password: string, role: string) => {
    const token = await getIdToken();
    const res = await fetch('/api/firebase-admin/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const deleteUser = async (uid: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/firebase-admin/users/${uid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const changeUserRole = async (uid: string, role: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/firebase-admin/users/${uid}/role`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const changeUserPassword = async (uid: string, password: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/firebase-admin/users/${uid}/password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  return { listUsers, createUser, deleteUser, changeUserRole, changeUserPassword };
}
