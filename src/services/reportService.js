import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
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
  await addDoc(ashaCollection, payload)
}

export const logVisitorLogin = async (data) => {
  const payload = {
    ...data,
    loggedAt: serverTimestamp()
  }
  await addDoc(visitorLoginsCollection, payload)
}

