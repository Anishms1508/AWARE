import { addDoc, collection, serverTimestamp, doc, setDoc } from 'firebase/firestore'
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

export const saveAshaWorkerReport = async (data) => {
  const payload = {
    ...data,
    submittedAt: serverTimestamp()
  }
  return addDoc(ashaCollection, payload)
}

export const logVisitorLogin = async (data) => {
  const docRef = doc(visitorLoginsCollection, data.userId)
  await setDoc(docRef, {
    ...data,
    lastLoginAt: serverTimestamp()
  })
}

