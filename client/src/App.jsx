import './App.css'
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/react'
import { MemorySpanRunner } from './pages/MemorySpanRunner.jsx';

export default function App() {

  return (
    <div>
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

      <main>
        <MemorySpanRunner />
      </main>
    </div>
  );
}