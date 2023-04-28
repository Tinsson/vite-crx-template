import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="p-3 w-40">
      <h1 className="mb-5 text-green-800">Vite + React + Tailwind</h1>
      <div>
        <button className="rounded bg-green-200 p-2" onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
