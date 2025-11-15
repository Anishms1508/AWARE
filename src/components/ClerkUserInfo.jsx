import { UserButton, useUser } from '@clerk/clerk-react'

function ClerkUserInfo() {
  const { user } = useUser()
  
  return (
    <>
      <span className="user-greeting">
        Welcome, {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User'}
      </span>
      <UserButton afterSignOutUrl="/" />
    </>
  )
}

export default ClerkUserInfo

