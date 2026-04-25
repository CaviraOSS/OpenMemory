"use client"

import { useState, useEffect } from "react"
import { useProject } from "@/lib/project-context"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export default function Navbar() {
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
    const { currentProject, setCurrentProject, projects } = useProject()

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
            <div className="bg-stone-950 rounded-xl p-2 flex items-center justify-between border border-stone-900 shadow-xl">
                <div className="flex items-center">
                    <button className="rounded-full size-9 my-1 mr-4 flex items-center justify-between hover:bg-stone-900 hover:text-stone-200 duration-300 transition-all text-stone-500">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 mx-auto">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
                        </svg>
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative space-x-2 flex items-center hover:bg-stone-900 rounded-lg w-fit p-1 px-2 cursor-pointer transition-colors group">
                            <h1 className="text-lg text-stone-200 font-medium">OpenMemory</h1>
                            <span className="text-[10px] bg-sky-500/10 text-sky-500 border border-sky-500/20 px-1.5 rounded uppercase tracking-wider font-bold">OSS</span>
                        </div>

                        <div className="h-6 w-[1px] bg-stone-800"></div>

                        {/* Project Selector for scoping memories and analytics */}
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 text-stone-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                            <select 
                                value={currentProject || ""} 
                                onChange={(e) => setCurrentProject(e.target.value || null)}
                                className="bg-transparent text-sm text-stone-300 outline-none cursor-pointer hover:text-stone-100 transition-colors appearance-none pr-4"
                            >
                                <option value="" className="bg-stone-950">All Projects</option>
                                {projects.map(p => (
                                    <option key={p} value={p} className="bg-stone-950">{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mr-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/50 border border-stone-800">
                        <div className="relative flex items-center">
                            <div className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-500 animate-pulse' :
                                backendStatus === 'offline' ? 'bg-red-500 animate-pulse' :
                                    'bg-yellow-500 animate-pulse'
                                }`}>
                            </div>
                        </div>
                        <span className="text-xs text-stone-400 font-medium">
                            {backendStatus === 'online' ? 'System Active' :
                                backendStatus === 'offline' ? 'Connection Lost' :
                                    'Checking...'}
                        </span>
                    </div>
                    <button className="rounded-xl p-2 flex justify-center hover:bg-stone-900/50 hover:text-stone-300 border border-stone-800 transition-all group">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 group-hover:rotate-90 transition-transform duration-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>
            </div>
        </nav>
    )
}
