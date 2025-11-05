"use client"

import { useState, useEffect } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export default function Navbar() {
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')

    useEffect(() => {
        checkBackendStatus()
        const interval = setInterval(checkBackendStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    const checkBackendStatus = async () => {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 2000)

            const response = await fetch(`${API_BASE_URL}/dashboard/health`, {
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (response.ok) {
                setBackendStatus('online')
            } else {
                setBackendStatus('offline')
            }
        } catch (error) {
            setBackendStatus('offline')
        }
    }

    return (
        <nav className="fixed top-0 w-full p-2 pl-20 z-40">
            <div className="bg-stone-950 rounded-xl p-2 flex items-center justify-between">
                <div className="flex items-center">
                    <button className="rounded-full size-9 my-1 mr-4 flex items-center justify-between hover:bg-stone-900 hover:text-stone-200 duration-300 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 mx-auto">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
                        </svg>
                    </button>
                    <div className="relative space-x-2 flex items-center hover:bg-stone-900 rounded-lg w-fit p-1">
                        <h1 className="text-lg text-stone-200 pl-1">OpenMemory</h1>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                    </div>
                </div>

                <div className="flex items-center gap-2 mr-3">
                    {}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/50 border border-stone-800">
                        <div className="relative flex items-center">
                            <div className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-500 animate-pulse' :
                                backendStatus === 'offline' ? 'bg-red-500 animate-pulse' :
                                    'bg-yellow-500 animate-pulse'
                                }`}>
                            </div>
                        </div>
                        <span className="text-xs text-stone-400">
                            {backendStatus === 'online' ? 'Backend Online' :
                                backendStatus === 'offline' ? 'Backend Offline' :
                                    'Checking...'}
                        </span>
                    </div>                    <button className="rounded-xl p-2 flex justify-center hover:bg-stone-900/50 hover:text-stone-300 border border-stone-800">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>
            </div>
        </nav>
    )
}
