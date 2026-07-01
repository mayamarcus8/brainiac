import './App.css'
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/react'

function App() {

  return (
    <>
      <header>
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
        <h1>brAIniac</h1>
      </header>
    </>
  )
}

export default App
