import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './firebase';

async function findAgnieszka() {
  const q = query(collection(db, 'users'));
  const snapshot = await getDocs(q);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.firstName === 'Agnieszka' && data.lastName === 'Wyrozumska') {
      console.log('Found Agnieszka:', doc.id);
    }
  });
}

findAgnieszka();
