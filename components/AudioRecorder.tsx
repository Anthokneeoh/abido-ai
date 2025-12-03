"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, Square, Loader2, Sparkles, RefreshCw, MessageCircle, AlertCircle, BarChart3, Waves, X, Info } from "lucide-react"

interface Feedback {
    transcript: string
    overall_vibe: string
    energy_level: string
    filler_words: string
    filler_count: number
    strength: string
    improvement_tip: string
    encouragement: string
    confidence_score: number
}

// TOOLTIP DEFINITIONS (Synced with Backend v2.2)
const VIBE_DEFINITIONS = [
    {
        label: "Confident",
        desc: "Strong, assured, and clear delivery with zero self-doubt.",
        score: "85-100",
        color: "text-green-400"
    },
    {
        label: "Enthusiastic",
        desc: "High energy, engaging, and dynamic presentation style.",
        score: "85-100",
        color: "text-green-400"
    },
    {
        label: "Natural",
        desc: "Conversational, authentic, and comfortable tone.",
        score: "70-84",
        color: "text-blue-400"
    },
    {
        label: "Nervous",
        desc: "Hesitant, shaky, or uncertain vocal patterns.",
        score: "55-69",
        color: "text-yellow-400"
    },
    {
        label: "Rushed",
        desc: "Speaking too fast, hard to follow, lacking pauses.",
        score: "40-54",
        color: "text-orange-400"
    },
    {
        label: "Monotone",
        desc: "Flat delivery, lacking emotion or dynamic range.",
        score: "0-39",
        color: "text-gray-400"
    },
    {
        label: "Unclear",
        desc: "Audio quality issues or inaudible speech detected.",
        score: "N/A",
        color: "text-gray-500"
    },
    {
        label: "Inappropriate",
        desc: "Content flagged for profanity or offensive language.",
        score: "N/A",
        color: "text-red-400"
    }
]

const ENERGY_DEFINITIONS = [
    {
        label: "High",
        desc: "Strong vocal projection, dynamic range, and commanding presence. Your voice fills the room.",
        icon: "🔊"
    },
    {
        label: "Medium",
        desc: "Conversational volume, balanced delivery, easy to listen to. Natural speaking level.",
        icon: "🎤"
    },
    {
        label: "Low",
        desc: "Quiet volume, mumbled delivery, or lacking vocal projection. Hard to hear clearly.",
        icon: "🔇"
    }
]

const LOADING_MESSAGES = [
    "Listening to your tone...",
    "Detecting filler words...",
    "Analyzing vocal confidence...",
    "Measuring speech patterns...",
    "Generating your scorecard..."
]

export function AudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const [error, setError] = useState<string>("")
    const [recordingTime, setRecordingTime] = useState(0)
    const [selectedDuration, setSelectedDuration] = useState<number>(60)

    const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
    const [activeTooltip, setActiveTooltip] = useState<"vibe" | "energy" | null>(null)
    const [isErrorPaused, setIsErrorPaused] = useState(false)
    const [touchStart, setTouchStart] = useState<number | null>(null)
    const [touchEnd, setTouchEnd] = useState<number | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<BlobPart[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Load saved duration preference
    useEffect(() => {
        const savedDuration = localStorage.getItem('abido_duration')
        if (savedDuration) {
            setSelectedDuration(parseInt(savedDuration))
        }
    }, [])

    // Save duration preference
    useEffect(() => {
        localStorage.setItem('abido_duration', selectedDuration.toString())
    }, [selectedDuration])

    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
            }, 2500)
        }
        return () => clearInterval(interval)
    }, [isLoading])

    useEffect(() => {
        if (error && !isErrorPaused) {
            const timer = setTimeout(() => setError(""), 5000)
            return () => clearTimeout(timer)
        }
    }, [error, isErrorPaused])

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null)
        setTouchStart(e.targetTouches[0].clientY)
        setIsErrorPaused(true)
    }

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientY)
    }

    const onTouchEnd = () => {
        setIsErrorPaused(false)
        if (!touchStart || !touchEnd) return
        const distance = touchStart - touchEnd
        if (distance > 50) setError("")
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            })

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm'
            })

            chunksRef.current = []

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })

                // Frontend validation for very short recordings
                if (chunksRef.current.length === 0 || audioBlob.size < 1000) {
                    setError("Recording too short. Please speak for at least 10 seconds.")
                    return
                }

                await analyzeAudio(audioBlob)
            }

            mediaRecorderRef.current.start()
            setIsRecording(true)
            setFeedback(null)
            setError("")
            setRecordingTime(0)

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    const newTime = prev + 1
                    if (newTime >= selectedDuration) {
                        stopRecording()
                        return selectedDuration
                    }
                    return newTime
                })
            }, 1000)

        } catch (err: any) {
            console.error("Microphone error:", err)

            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setError(
                    "Microphone access denied. Go to Settings > Privacy > Microphone and enable access for your browser."
                )
            } else {
                setError("Microphone access failed. Ensure your device has a microphone and try refreshing the page.")
            }
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop()
            setIsRecording(false)

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        }
    }

    const analyzeAudio = async (audioBlob: Blob) => {
        setIsLoading(true)
        setLoadingMsgIndex(0)
        setError("")

        const minDelayPromise = new Promise(resolve => setTimeout(resolve, 3000))
        const formData = new FormData()
        formData.append("audio", audioBlob, "speech.webm")

        try {
            const fetchPromise = fetch("/api/analyze", {
                method: "POST",
                body: formData,
            })

            const [response] = await Promise.all([fetchPromise, minDelayPromise])

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`)
            }

            const data = await response.json()

            if (data.error) {
                setError(data.error)
            } else {
                setFeedback(data)
                // Special handling for invalid audio (score 0)
                if (data.confidence_score === 0) {
                    console.log("Invalid audio detected - showing recovery suggestions")
                }
            }
        } catch (err: any) {
            console.error("Analysis error:", err)
            setError(err.message || "Network error. Please check your connection and try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const getConfidenceColor = (score: number) => {
        if (score >= 85) return "text-green-400"
        if (score >= 70) return "text-blue-400"
        if (score >= 55) return "text-yellow-400"
        if (score >= 40) return "text-orange-400"
        return "text-red-400"
    }

    const getConfidenceLabel = (score: number) => {
        if (score >= 85) return "Excellent"
        if (score >= 70) return "Strong"
        if (score >= 55) return "Developing"
        if (score >= 40) return "Needs Work"
        return "Beginner"
    }

    const getConfidenceDescription = (score: number) => {
        if (score >= 85) return "Exceptional delivery - ready for professional speaking"
        if (score >= 70) return "Strong foundation with room for polish"
        if (score >= 55) return "Good start - focus on key improvements"
        if (score >= 40) return "Developing - practice will build confidence"
        return "Beginner level - every expert starts here"
    }

    return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 font-sans relative px-4">

            {/* ERROR TOAST */}
            {error && (
                <div className="fixed top-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
                    <div
                        className="bg-red-500/95 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto cursor-grab active:cursor-grabbing touch-none max-w-sm w-full animate-in slide-in-from-top-4 duration-500"
                        style={{ animationTimingFunction: "cubic-bezier(0.68, -0.55, 0.27, 1.55)" }}
                        onMouseEnter={() => setIsErrorPaused(true)}
                        onMouseLeave={() => setIsErrorPaused(false)}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold text-base">Error</p>
                            <p className="text-sm leading-tight mt-1">{error}</p>
                            <p className="text-[10px] text-white/60 mt-2 uppercase tracking-wider font-bold">
                                {isErrorPaused ? "Paused" : "Swipe up to dismiss"}
                            </p>
                        </div>
                        <button onClick={() => setError("")} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* TOOLTIP MODAL */}
            {activeTooltip && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={() => setActiveTooltip(null)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto md:w-full md:max-w-md z-50 bg-[#1c1c1e] border-t md:border border-gray-700 rounded-t-3xl md:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Info className="h-5 w-5 text-pink-500" />
                                {activeTooltip === "vibe" ? "Vibe Definitions" : "Energy Levels"}
                            </h3>
                            <button onClick={() => setActiveTooltip(null)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                                <X className="h-5 w-5 text-white" />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2" style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: '#4a4a4a #1c1c1e'
                        }}>
                            {activeTooltip === "vibe" ? (
                                VIBE_DEFINITIONS.map((def, i) => (
                                    <div key={i} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className={`${def.color} font-bold text-base`}>{def.label}</p>
                                            {def.score !== "N/A" && (
                                                <span className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded">{def.score}</span>
                                            )}
                                        </div>
                                        <p className="text-gray-300 text-sm leading-relaxed">{def.desc}</p>
                                    </div>
                                ))
                            ) : (
                                ENERGY_DEFINITIONS.map((def, i) => (
                                    <div key={i} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                        <p className="text-pink-400 font-bold text-base mb-2 flex items-center gap-2">
                                            <span className="text-2xl">{def.icon}</span>
                                            {def.label}
                                        </p>
                                        <p className="text-gray-300 text-sm leading-relaxed">{def.desc}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* HEADER */}
            {!feedback && !isLoading && (
                <div className="flex flex-col items-center gap-2 mb-2 animate-in fade-in w-full">
                    <div className="flex flex-col items-center mb-2">
                        <div className="bg-yellow-400 p-3 rounded-2xl rotate-3 shadow-lg mb-2">
                            <MessageCircle className="h-8 w-8 text-yellow-900 fill-yellow-900" />
                        </div>
                        <h1 className="text-3xl font-bold text-orange-400 tracking-tight">Abido</h1>
                    </div>

                    <div className="text-center space-y-1">
                        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                            Welcome to <span className="text-pink-500">Abido AI</span>
                        </h2>
                        <p className="text-gray-400 text-lg font-medium max-w-[280px] mx-auto leading-tight mt-2">
                            Your expert public speaking coach
                        </p>
                    </div>
                </div>
            )}

            {/* MAIN CARD */}
            <div className="w-full bg-[#1c1c1e] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">

                {/* SELECTION SCREEN */}
                {!isRecording && !isLoading && !feedback && (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-white">Choose recording duration</h3>
                            <p className="text-gray-400 text-sm">Speak for 30 - 90 seconds</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
                            {[30, 45, 60, 75].map((time) => (
                                <button
                                    key={time}
                                    onClick={() => setSelectedDuration(time)}
                                    className={`py-3 rounded-2xl font-semibold transition-all ${selectedDuration === time
                                        ? "bg-[#2c2c2e] text-white border-2 border-pink-500"
                                        : "bg-[#2c2c2e] text-gray-400 hover:bg-[#3a3a3c] border-2 border-transparent"
                                        }`}
                                >
                                    {time}s
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedDuration(90)}
                                className={`col-span-2 py-3 rounded-2xl font-semibold transition-all ${selectedDuration === 90
                                    ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                                    : "bg-[#2c2c2e] text-gray-400 hover:bg-[#3a3a3c]"
                                    }`}
                            >
                                90s (Recommended)
                            </button>
                        </div>

                        <button
                            onClick={startRecording}
                            className="w-full py-5 rounded-2xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xl shadow-xl shadow-pink-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95 mt-4"
                        >
                            <Mic className="h-6 w-6" /> Start Recording
                        </button>
                        <div className="bg-gray-800/50 px-4 py-1 rounded-full text-xs text-gray-500 font-mono mt-2">
                            🔒 Your voice is never stored
                        </div>
                    </div>
                )}

                {/* RECORDING SCREEN */}
                {isRecording && (
                    <div className="flex flex-col items-center gap-8 py-6 animate-in fade-in">
                        <div className="relative">
                            <span className="absolute -inset-6 bg-pink-500/20 rounded-full animate-ping opacity-75"></span>
                            <div className="h-28 w-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-pink-500 z-10 relative">
                                <Mic className="h-12 w-12 text-pink-500" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-pink-400 font-bold tracking-widest uppercase text-xs animate-pulse">Recording</p>
                            <p className="text-6xl font-mono font-black text-white tabular-nums tracking-tighter">{formatTime(recordingTime)}</p>
                            <p className="text-sm text-gray-500 font-medium">Goal: {selectedDuration}s</p>
                            <div className="w-full max-w-[200px] mx-auto mt-4">
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-1000" style={{ width: `${(recordingTime / selectedDuration) * 100}%` }} />
                                </div>
                            </div>
                        </div>
                        <button onClick={stopRecording} className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all mt-4">
                            <Square className="h-5 w-5 fill-current" /> Stop & Analyze
                        </button>
                    </div>
                )}

                {/* LOADING SCREEN */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
                        <div className="relative mb-8">
                            <div className="absolute -inset-4 bg-pink-500/20 rounded-full blur-xl animate-pulse"></div>
                            <Waves className="h-20 w-20 text-pink-500 animate-bounce" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 text-center min-h-[40px]">
                            {LOADING_MESSAGES[loadingMsgIndex]}
                        </h3>
                        <div className="w-48 h-1.5 bg-gray-800 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 animate-pulse w-full"></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-6 font-mono">Powered by Gemini's latest Pro Model</p>
                    </div>
                )}

                {/* RESULTS SCREEN */}
                {feedback && (
                    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">Your Results</h3>
                            <span className="bg-gray-800 text-xs font-mono py-1 px-2 rounded text-gray-400">AI Analysis</span>
                        </div>

                        <div className="text-center py-2">
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Confidence Score</p>
                            <div className="flex items-center justify-center gap-2">
                                <p className={`text-7xl font-black ${getConfidenceColor(feedback.confidence_score)}`}>{feedback.confidence_score}</p>
                                <span className="text-2xl text-gray-600 font-bold self-end mb-2">/100</span>
                            </div>
                            <p className={`text-sm font-bold mt-2 ${getConfidenceColor(feedback.confidence_score)}`}>
                                {getConfidenceLabel(feedback.confidence_score)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1 max-w-[280px] mx-auto">
                                {getConfidenceDescription(feedback.confidence_score)}
                            </p>
                        </div>

                        <div className="bg-[#2c2c2e] p-5 rounded-2xl border-l-4 border-yellow-400">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-yellow-400" />
                                <span className="font-bold text-white text-sm">Expert Feedback</span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">"{feedback.encouragement}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div
                                onClick={() => setActiveTooltip("vibe")}
                                className="bg-[#2c2c2e] p-4 rounded-2xl cursor-pointer hover:bg-[#363638] transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs text-gray-500 font-bold uppercase">Vibe</p>
                                    <Info className="h-3 w-3 text-gray-600 group-hover:text-pink-400 transition-colors" />
                                </div>
                                <p className="text-lg font-bold text-white capitalize">{feedback.overall_vibe}</p>
                                <p className="text-[10px] text-gray-400 mt-1">Tap for details</p>
                            </div>

                            <div
                                onClick={() => setActiveTooltip("energy")}
                                className="bg-[#2c2c2e] p-4 rounded-2xl cursor-pointer hover:bg-[#363638] transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs text-gray-500 font-bold uppercase">Energy</p>
                                    <Info className="h-3 w-3 text-gray-600 group-hover:text-pink-400 transition-colors" />
                                </div>
                                <p className="text-lg font-bold text-white capitalize">{feedback.energy_level}</p>
                                <p className="text-[10px] text-gray-400 mt-1">Tap for details</p>
                            </div>
                        </div>

                        <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl">
                            <p className="text-xs text-orange-400 font-bold uppercase mb-2">Filler Words</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-orange-400">{feedback.filler_count}</p>
                                <p className="text-sm text-gray-400">{feedback.filler_words}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl">
                                <p className="text-xs text-green-400 font-bold uppercase mb-2">✓ Strength</p>
                                <p className="text-sm text-gray-300">{feedback.strength}</p>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl">
                                <p className="text-xs text-blue-400 font-bold uppercase mb-2">→ Priority Fix</p>
                                <p className="text-sm text-gray-300">{feedback.improvement_tip}</p>
                            </div>
                        </div>

                        <button onClick={() => { setFeedback(null); setError("") }} className="w-full py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg">
                            <RefreshCw className="h-5 w-5" /> Record Another Speech
                        </button>

                        <details className="text-xs text-gray-500 cursor-pointer text-center group">
                            <summary className="hover:text-gray-300 transition-colors font-bold flex items-center justify-center gap-2 list-none">
                                <BarChart3 className="h-4 w-4" /> View Transcript
                            </summary>
                            <p className="mt-2 text-left p-4 bg-black/30 rounded-xl italic text-gray-300 leading-relaxed border border-gray-800">
                                "{feedback.transcript}"
                            </p>
                        </details>
                    </div>
                )}
            </div>

            {/* FOOTER - Fixed typo and responsive */}
            <div className="text-xs text-gray-600 text-center mt-2 px-4">
                <p className="font-medium text-gray-400 mb-0.5">
                    Powered by Gemini's latest Pro Model
                </p>
                <p className="text-gray-500">
                    Analysis is experimental
                </p>
            </div>
        </div>
    )
}