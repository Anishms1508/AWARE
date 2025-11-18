import { addDoc, collection, serverTimestamp, doc, setDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

const emergencyCollection = collection(db, 'emergencyReports')
const ashaCollection = collection(db, 'ashaWorkerReports')
const visitorLoginsCollection = collection(db, 'visitorLoginEvents')

export const saveEmergencyReport = async (data) => {
  const payload = {
    ...data,
    submittedAt: serverTimestamp()
  }
  await addDoc(emergencyCollection, payload)
}

export const fetchEmergencyReports = async () => {
  const q = query(emergencyCollection, orderBy('submittedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      submittedAt: data.submittedAt ? data.submittedAt.toDate().toISOString() : null
    }
  })
}

export const saveAshaWorkerReport = async (data) => {
  const payload = {
    ...data,
    submittedAt: serverTimestamp()
  }
  return addDoc(ashaCollection, payload)
}

export const fetchAshaReports = async () => {
  const q = query(ashaCollection, orderBy('submittedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      submittedAt: data.submittedAt ? data.submittedAt.toDate().toISOString() : null
    }
  })
}

export const deleteAshaReport = async (id) => {
  if (!id) {
    throw new Error('Report id is required to delete an ASHA report')
  }
  const ref = doc(ashaCollection, id)
  await deleteDoc(ref)
}

export const logVisitorLogin = async (data) => {
  const docRef = doc(visitorLoginsCollection, data.userId)
  await setDoc(docRef, {
    ...data,
    lastLoginAt: serverTimestamp()
  })
}

