import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut, useUser, UserButton, SignInButton } from '@clerk/clerk-react'
import './Navbar.css'

function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const location = useLocation()
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const menuItemsRef = useRef([])
  const { user } = useUser()
  const userButtonRef = useRef(null)

  const handleUserButtonClick = (e) => {
    // Prevent double-clicking if clicking directly on UserButton
    if (e.target.closest('[data-clerk-element="userButton"]')) {
      return
    }
    // Find and click the UserButton trigger inside
    const userButton = userButtonRef.current?.querySelector('button')
    if (userButton) {
      e.preventDefault()
      userButton.click()
    }
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev)
    setFocusedIndex(-1)
  }

  const closeDropdown = () => {
    setIsDropdownOpen(false)
    setFocusedIndex(-1)
    // Return focus to button
    if (buttonRef.current) {
      buttonRef.current.focus()
    }
  }

  // Get menu items (filtering out disabled items)
  const getMenuItems = () => {
    const items = []
    items.push({ type: 'link', to: '/', label: 'Landing Page', icon: '🏠', enabled: true })
    
    items.push({ type: 'link', to: '/emergency-request', label: 'Emergency Request', icon: '🚨', enabled: true })
    
    // Check if user is signed in for dashboard
    const isSignedIn = user !== null && user !== undefined
    if (isSignedIn) {
      items.push({ type: 'link', to: '/dashboard', label: 'Dashboard', icon: '📊', enabled: true })
    } else {
      items.push({ type: 'div', label: 'Dashboard (Sign in required)', icon: '📊', enabled: false })
    }
    
    return items
  }

  const menuItems = getMenuItems()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown()
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isDropdownOpen) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggleDropdown()
        }
        return
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          closeDropdown()
          break
        case 'ArrowDown':
          event.preventDefault()
          setFocusedIndex(prev => {
            const nextIndex = prev < menuItems.length - 1 ? prev + 1 : 0
            if (menuItemsRef.current[nextIndex]) {
              menuItemsRef.current[nextIndex].focus()
            }
            return nextIndex
          })
          break
        case 'ArrowUp':
          event.preventDefault()
          setFocusedIndex(prev => {
            const nextIndex = prev > 0 ? prev - 1 : menuItems.length - 1
            if (menuItemsRef.current[nextIndex]) {
              menuItemsRef.current[nextIndex].focus()
            }
            return nextIndex
          })
          break
        case 'Tab':
          // Allow Tab to work normally for focus trapping
          if (!event.shiftKey && focusedIndex === menuItems.length - 1) {
            // If on last item and Tab, cycle to first
            event.preventDefault()
            setFocusedIndex(0)
            if (menuItemsRef.current[0]) {
              menuItemsRef.current[0].focus()
            }
          } else if (event.shiftKey && focusedIndex === 0) {
            // If on first item and Shift+Tab, cycle to last
            event.preventDefault()
            const lastIndex = menuItems.length - 1
            setFocusedIndex(lastIndex)
            if (menuItemsRef.current[lastIndex]) {
              menuItemsRef.current[lastIndex].focus()
            }
          }
          break
        case 'Home':
          event.preventDefault()
          setFocusedIndex(0)
          if (menuItemsRef.current[0]) {
            menuItemsRef.current[0].focus()
          }
          break
        case 'End':
          event.preventDefault()
          const lastIndex = menuItems.length - 1
          setFocusedIndex(lastIndex)
          if (menuItemsRef.current[lastIndex]) {
            menuItemsRef.current[lastIndex].focus()
          }
          break
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Focus first menu item when opening
      if (menuItemsRef.current[0] && focusedIndex === -1) {
        setTimeout(() => {
          menuItemsRef.current[0]?.focus()
          setFocusedIndex(0)
        }, 100)
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDropdownOpen, focusedIndex, menuItems.length])

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeDropdown}>
          <img src="/aware_logo.png" alt="AWARE Logo" className="logo-image" />
        </Link>
        
        <div className="navbar-right">
          <SignedIn>
            <button 
              className="navbar-user-button"
              onClick={handleUserButtonClick}
              type="button"
              aria-label="User menu"
            >
              <span className="navbar-user-name">
                {user?.firstName || user?.emailAddresses[0]?.emailAddress}
              </span>
              <span ref={userButtonRef}>
                <UserButton afterSignOutUrl="/" />
              </span>
            </button>
          </SignedIn>
          
          <SignedOut>
            <SignInButton mode="modal">
              <button 
                className="navbar-user-button"
                type="button"
                aria-label="Sign in"
              >
                <span className="navbar-user-name">Sign In</span>
                <span className="navbar-user-icon">👤</span>
              </button>
            </SignInButton>
          </SignedOut>
          
          <div className="navbar-menu" ref={dropdownRef}>
            <button 
              ref={buttonRef}
              id="nav-toggle"
              className={`hamburger-menu ${isDropdownOpen ? 'is-open' : ''}`}
              onClick={toggleDropdown}
              aria-controls="main-nav"
              aria-expanded={isDropdownOpen}
              aria-label={isDropdownOpen ? 'Close navigation menu' : 'Open navigation menu'}
              type="button"
            >
              <span className="hamburger-bar bar-top"></span>
              <span className="hamburger-bar bar-mid"></span>
              <span className="hamburger-bar bar-bot"></span>
            </button>
            
            <nav 
              id="main-nav"
              ref={menuRef}
              className={`navbar-dropdown ${isDropdownOpen ? 'is-open' : ''}`}
              hidden={!isDropdownOpen}
              role="menu"
              aria-label="Navigation menu"
            >
              {menuItems.map((item, index) => {
                if (item.type === 'link' && item.enabled) {
                  return (
                    <Link
                      key={index}
                      ref={el => menuItemsRef.current[index] = el}
                      to={item.to}
                      className={`dropdown-item ${location.pathname === item.to ? 'active' : ''}`}
                      onClick={closeDropdown}
                      role="menuitem"
                      tabIndex={isDropdownOpen ? 0 : -1}
                    >
                      <span className="dropdown-icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                } else {
                  return (
                    <div
                      key={index}
                      className="dropdown-item disabled"
                      role="menuitem"
                      tabIndex={-1}
                      aria-disabled="true"
                    >
                      <span className="dropdown-icon">{item.icon}</span>
                      {item.label}
                    </div>
                  )
                }
              })}
            </nav>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
