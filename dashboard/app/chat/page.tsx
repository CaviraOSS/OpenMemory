"use client"

import { useState, useEffect, useRef } from "react"
import { API_BASE_URL, getHeaders } from "@/lib/api"

interface ChatMessage {
    role: "user" | "assistant"
    content: string
    timestamp: number
}

interface MemoryReference {
    id: string
    sector: "semantic" | "episodic" | "procedural" | "emotional" | "reflective"
    content: string
    salience: number
    title: string
}

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [busy, setBusy] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [awaitingAnswer, setAwaitingAnswer] = useState(false)
    const [memories, setMemories] = useState<MemoryReference[]>([])
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0)
    }, [messages.length])

    const queryMemories = async (query: string): Promise<MemoryReference[]> => {
        try {
            const response = await fetch(`${API_BASE_URL}/memory/query`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    query,
                    k: 10,
                    filters: {}
                })
            })

            if (!response.ok) {
                throw new Error("Failed to query memories")
            }

            const data = await response.json()
            return data.matches.map((match: any) => ({
                id: match.id,
                sector: match.primary_sector || "semantic",
                content: match.content,
                salience: match.salience || match.score,
                title: match.content.substring(0, 50) + (match.content.length > 50 ? "..." : "")
            }))
        } catch (error) {
            console.error("Error querying memories:", error)
            return []
        }
    }

    const generateResponse = async (userQuery: string, relevantMemories: MemoryReference[]): Promise<string> => {
        if (relevantMemories.length === 0) {
            return "I don't have any memories that directly relate to your question. Try asking about topics you've previously stored in your memory system, or add more memories to help me answer better."
        }

        const queryLower = userQuery.toLowerCase()
        const isQuestion = queryLower.includes('?') ||
            queryLower.startsWith('what') ||
            queryLower.startsWith('how') ||
            queryLower.startsWith('why') ||
            queryLower.startsWith('when') ||
            queryLower.startsWith('where') ||
            queryLower.startsWith('who') ||
            queryLower.startsWith('can') ||
            queryLower.startsWith('is') ||
            queryLower.startsWith('do') ||
            queryLower.startsWith('does')

        const sectorGroups: Record<string, MemoryReference[]> = {}
        relevantMemories.forEach(mem => {
            if (!sectorGroups[mem.sector]) {
                sectorGroups[mem.sector] = []
            }
            sectorGroups[mem.sector].push(mem)
        })

        const hasSemantic = sectorGroups['semantic']?.length > 0
        const hasEpisodic = sectorGroups['episodic']?.length > 0
        const hasProcedural = sectorGroups['procedural']?.length > 0
        const hasEmotional = sectorGroups['emotional']?.length > 0
        const hasReflective = sectorGroups['reflective']?.length > 0

        let response = ""

        if (isQuestion) {
            if (hasSemantic) {
                response += "Based on what I know:\n\n"
                const topSemantic = sectorGroups['semantic'].slice(0, 3)
                topSemantic.forEach((mem, idx) => {
                    response += `${mem.content}`
                    if (idx < topSemantic.length - 1) response += "\n\n"
                })
            } else if (hasEpisodic) {
                response += "From your past experiences:\n\n"
                const topEpisodic = sectorGroups['episodic'].slice(0, 2)
                topEpisodic.forEach((mem, idx) => {
                    response += `${mem.content}`
                    if (idx < topEpisodic.length - 1) response += "\n\n"
                })
            } else if (hasProcedural) {
                response += "Here's what I remember about the process:\n\n"
                const topProcedural = sectorGroups['procedural'].slice(0, 2)
                topProcedural.forEach((mem, idx) => {
                    response += `${mem.content}`
                    if (idx < topProcedural.length - 1) response += "\n\n"
                })
            }

            if (hasEpisodic && hasSemantic) {
                response += "\n\n**Related experience:**\n"
                response += sectorGroups['episodic'][0].content
            }

            if (hasProcedural && (hasSemantic || hasEpisodic)) {
                response += "\n\n**How to apply this:**\n"
                response += sectorGroups['procedural'][0].content
            }

            if (hasEmotional) {
                response += "\n\n**Emotional context:**\n"
                response += sectorGroups['emotional'][0].content
            }

            if (hasReflective) {
                response += "\n\n**Insight:**\n"
                response += sectorGroups['reflective'][0].content
            }
        } else {
            const allMemories = relevantMemories.slice(0, 5)

            if (hasSemantic && hasEpisodic) {
                response += `${sectorGroups['semantic'][0].content}\n\n`
                response += `This connects to when ${sectorGroups['episodic'][0].content.toLowerCase()}`
            } else if (hasSemantic) {
                response += sectorGroups['semantic'].slice(0, 2).map(m => m.content).join('\n\n')
            } else if (hasEpisodic) {
                response += "Based on your experiences:\n\n"
                response += sectorGroups['episodic'].slice(0, 3).map(m => m.content).join('\n\n')
            } else {
                response += allMemories.map(m => m.content).join('\n\n')
            }

            if (hasProcedural && response.length < 500) {
                response += "\n\n**Steps involved:**\n"
                response += sectorGroups['procedural'][0].content
            }

            if (hasReflective && response.length < 600) {
                response += "\n\n**Reflection:**\n"
                response += sectorGroups['reflective'][0].content
            }
        }

        const avgSalience = relevantMemories.reduce((sum, m) => sum + m.salience, 0) / relevantMemories.length
        const confidence = avgSalience > 0.7 ? "high" : avgSalience > 0.4 ? "moderate" : "low"

        const memoryCount = relevantMemories.length
        const sectorCount = Object.keys(sectorGroups).length

        response += `\n\n---\n*Retrieved ${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} from ${sectorCount} ${sectorCount === 1 ? 'sector' : 'sectors'} • Confidence: ${confidence}*`

        return response
    }

    const sendMessage = async () => {
        if (!input.trim() || busy) return

        const userMessage: ChatMessage = {
            role: "user",
            content: input,
            timestamp: Date.now()
        }

        setMessages(prev => [...prev, userMessage])
        const currentInput = input
        setInput("")
        setAwaitingAnswer(true)
        setBusy(true)

        try {
            // Query memories from backend
            const relevantMemories = await queryMemories(currentInput)
            setMemories(relevantMemories)

            // Generate response based on memories
            const responseContent = await generateResponse(currentInput, relevantMemories)

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: responseContent,
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error("Error processing message:", error)
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "I encountered an error while processing your message. Please make sure the OpenMemory backend is running on port 8080.",
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setAwaitingAnswer(false)
            setBusy(false)
        }
    }

    const addMemoryToBag = async (memory: MemoryReference) => {
        try {
            // Reinforce the memory by increasing its salience
            await fetch(`${API_BASE_URL}/memory/reinforce`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    id: memory.id,
                    boost: 0.1
                })
            })
            console.log("Memory reinforced:", memory.id)
        } catch (error) {
            console.error("Error reinforcing memory:", error)
        }
    }

    return (
        <div className="flex flex-col min-h-screen w-full" suppressHydrationWarning>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6 mb-16" suppressHydrationWarning>
                { }
                <div className="flex-1 pr-6">
                    <div className="w-full max-w-5xl mx-auto p-4 pt-2 pb-28">
                        <div className="space-y-6">
                            {messages.map((m, i) => {
                                if (m.role === "assistant") {
                                    return (
                                        <div key={i} className="w-full flex justify-start">
                                            <div className="w-full mx-auto rounded-3xl bg-stone-950/90 border border-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] ring-1 ring-black/10 backdrop-blur px-6 md:px-8 py-6 md:py-8 max-w-[min(100%,1000px)]">
                                                <div className="animate-[fadeIn_300ms_ease-out] leading-7 md:leading-8 text-stone-300 whitespace-pre-wrap">
                                                    {m.content}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return (
                                    <div key={i} className="w-full flex justify-start">
                                        <div className="inline-block max-w-[85%] bg-stone-900/70 border border-zinc-800 rounded-2xl px-4 py-3">
                                            <div className="text-stone-200 whitespace-pre-wrap leading-relaxed">{m.content}</div>
                                        </div>
                                    </div>
                                )
                            })}
                            {(connecting || awaitingAnswer) && (
                                <div className="w-full flex justify-start">
                                    <div className="bg-stone-900/70 border border-zinc-800 rounded-2xl px-4 py-3">
                                        <div className="flex gap-2 items-center text-stone-400">
                                            <div className="flex gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-stone-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                                                <div className="w-2 h-2 rounded-full bg-stone-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                                                <div className="w-2 h-2 rounded-full bg-stone-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                                            </div>
                                            <span className="text-sm">{connecting ? "Connecting…" : "Thinking…"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </div>

                    { }
                    <div className="fixed bottom-0 left-0 right-0 lg:left-28 lg:right-[360px] bg-black/80 backdrop-blur-xl border-t border-zinc-900 p-4">
                        <div className="max-w-5xl mx-auto">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            sendMessage()
                                        }
                                    }}
                                    placeholder="Ask about your memories..."
                                    className="flex-1 bg-stone-950 border border-stone-900 rounded-2xl px-4 py-3 text-sm text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-stone-800"
                                    disabled={busy}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={busy || !input.trim()}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white font-medium"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                { }
                <div className="hidden lg:block">
                    <div className="sticky top-6 h-[calc(100vh-8rem)] flex flex-col">
                        <div className="mb-5">
                            <div className="rounded-2xl bg-stone-950/80 border border-zinc-900 px-4 py-3 flex items-center justify-between">
                                <h3 className="text-stone-100 font-semibold tracking-wide">Memories Used</h3>
                                <span className="text-xs text-stone-400">{memories.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-8">
                            {memories.length === 0 ? (
                                <div className="text-stone-400 text-sm bg-stone-950/60 border border-zinc-900 rounded-2xl p-6 text-center">
                                    No memories referenced yet
                                </div>
                            ) : (
                                memories.map((memory) => (
                                    <div
                                        key={memory.id}
                                        className="group rounded-2xl bg-stone-950/80 border border-zinc-900 hover:bg-stone-900/80 transition-colors shadow-[0_6px_24px_rgba(0,0,0,0.35)]"
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs px-2 py-1 rounded-lg bg-stone-900 text-stone-300 uppercase tracking-wide">
                                                            {memory.sector}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-3 text-amber-500">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                                            </svg>
                                                            <span className="text-xs text-stone-400">{(memory.salience * 100).toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                    <h4 className="text-stone-50 text-sm font-medium leading-5 truncate mb-1">
                                                        {memory.title}
                                                    </h4>
                                                    <p className="text-stone-400 text-xs leading-5 line-clamp-3">
                                                        {memory.content}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => addMemoryToBag(memory)}
                                                    className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-xl bg-stone-900/70 border border-zinc-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                                                    aria-label="Add to bag"
                                                    title="Add to bag"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12H5" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
