const rawAllowedEmails =
  import.meta.env.VITE_ALLOWED_OFFICIAL_EMAILS ||
  import.meta.env.NX_ALLOWED_OFFICIAL_EMAILS ||
  ''

const allowedOfficialEmails = rawAllowedEmails
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export const hasOfficialAccess = (user) => {
  if (!user || allowedOfficialEmails.length === 0) {
    return false
  }

  const userEmails = [
    user.primaryEmailAddress?.emailAddress,
    ...(user.emailAddresses || []).map(entry => entry.emailAddress)
  ]
    .filter(Boolean)
    .map(email => email.toLowerCase())

  return userEmails.some(email => allowedOfficialEmails.includes(email))
}

export const getAllowedOfficialEmails = () => [...allowedOfficialEmails]

