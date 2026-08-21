import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { extractErrorMessage } from '../services/geminiService';

export function useFirebaseAdminApi() {
  const { user } = useAuth();

  const getIdToken = async () => {
    if (!auth || !auth.currentUser) throw new Error('Not authenticated');
    return await auth.currentUser.getIdToken();
  };

  const handleResponse = async (res: Response) => {
    if (!res.ok) {
      const errText = await res.text();
      let errData: any = null;
      try {
        errData = JSON.parse(errText);
      } catch {}
      throw new Error(extractErrorMessage(errData, errText || `API Error (${res.status})`));
    }
    return res.json();
  };

  const listUsers = async () => {
    const token = await getIdToken();
    const res = await fetch('/api/admin-users/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res);
  };

  const createUser = async (email: string, password: string, role: string) => {
    const token = await getIdToken();
    const res = await fetch('/api/admin-users/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });
    return handleResponse(res);
  };

  const deleteUser = async (uid: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/admin-users/users/${uid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res);
  };

  const changeUserRole = async (uid: string, role: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/admin-users/users/${uid}/role`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });
    return handleResponse(res);
  };

  const changeUserPassword = async (uid: string, password: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/admin-users/users/${uid}/password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    return handleResponse(res);
  };

  return { listUsers, createUser, deleteUser, changeUserRole, changeUserPassword };
}
