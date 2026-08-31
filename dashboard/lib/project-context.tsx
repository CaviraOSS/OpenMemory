/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/lib/project-context.tsx
 *  usage : supports the LongMemory dashboard project context
 */


"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface ProjectContextType {
    currentProject: string | null
    setCurrentProject: (id: string | null) => void
    projects: string[]
    isLoading: boolean
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [currentProject, setCurrentProjectState] = useState<string | null>(null)
    const [projects, setProjects] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load the last selected project from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("longmemory_current_project")
        if (saved && saved !== "null") {
            setCurrentProjectState(saved)
        }
        // Fetch the list of available projects from the backend
        fetchProjects()
    }, [])

    const setCurrentProject = (id: string | null) => {
        setCurrentProjectState(id)
        // Persist selection to localStorage
        if (id) {
            localStorage.setItem("longmemory_current_project", id)
        } else {
            localStorage.removeItem("longmemory_current_project")
        }
    }

    const fetchProjects = async () => {
        setIsLoading(true)
        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/longmemory'
            const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
            if (res.ok) {
                const data = await res.json()
                setProjects(data.projects || [])
            }
        } catch (e) {
            console.error("Failed to fetch projects:", e)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <ProjectContext.Provider value={{ currentProject, setCurrentProject, projects, isLoading }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider")
    }
    return context
}
