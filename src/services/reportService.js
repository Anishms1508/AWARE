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
  try {
    const ref = doc(ashaCollection, id)
    await deleteDoc(ref)
    console.log('Successfully deleted ASHA report:', id)
  } catch (error) {
    console.error('Error deleting ASHA report:', error)
    throw new Error(`Failed to delete report: ${error.message || 'Permission denied. Please check Firestore security rules.'}`)
  }
}

export const deleteEmergencyReport = async (id) => {
  if (!id) {
    throw new Error('Report id is required to delete an emergency report')
  }
  try {
    const ref = doc(emergencyCollection, id)
    await deleteDoc(ref)
    console.log('Successfully deleted emergency report:', id)
  } catch (error) {
    console.error('Error deleting emergency report:', error)
    throw new Error(`Failed to delete emergency request: ${error.message || 'Permission denied. Please check Firestore security rules.'}`)
  }
}

export const logVisitorLogin = async (data) => {
  const docRef = doc(visitorLoginsCollection, data.userId)
  await setDoc(docRef, {
    ...data,
    lastLoginAt: serverTimestamp()
  })
}

