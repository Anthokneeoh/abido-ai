"use client"

import { useState, useRef } from "react"
import { Mic, Square, Loader2, Sparkles, RefreshCw, MessageCircle, AlertCircle } from "lucide-react"

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

export function AudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const [error, setError] = useState<string>("")
    const [recordingTime, setRecordingTime] = useState(0)
    const [selectedDuration, setSelectedDuration] = useState<number>(60)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<BlobPart[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const startRecording = async () => {
        try {
            // Request microphone access
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
                console.log("Recording stopped. Size:", audioBlob.size, "bytes")
                await analyzeAudio(audioBlob)
            }

            mediaRecorderRef.current.start()
            setIsRecording(true)
            setFeedback(null)
            setError("")
            setRecordingTime(0)

            // Start timer and auto-stop at selected duration
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

        } catch (err) {
            console.error("Microphone error:", err)
            setError("Microphone access denied. Please enable it in browser settings.")
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

            // Stop all tracks to turn off microphone indicator
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        }
    }

    const analyzeAudio = async (audioBlob: Blob) => {
        setIsLoading(true)
        const formData = new FormData()
        formData.append("audio", audioBlob, "speech.webm")

        try {
            console.log("Sending audio for analysis...")
            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`)
            }

            const data = await response.json()
            console.log("Analysis result:", data)

            if (data.error) {
                setError(data.error)
            } else {
                // Validate data structure
                if (!data.confidence_score || !data.filler_count) {
                    console.warn("Missing expected fields:", data)
                }
                setFeedback(data)
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
        if (score >= 50) return "text-yellow-400"
        return "text-orange-400"
    }

    const getConfidenceLabel = (score: number) => {
        if (score >= 85) return "Excellent"
        if (score >= 70) return "Good"
        if (score >= 50) return "Fair"
        return "Needs Work"
    }

    return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
            {/* 1. ABIDO LOGO & HEADER */}
            {!feedback && (
                <div className="flex flex-col items-center gap-2 mb-2 animate-in fade-in">
                    <div className="bg-yellow-400 p-3 rounded-2xl rotate-3 shadow-lg mb-2">
                        <MessageCircle className="h-8 w-8 text-yellow-900 fill-yellow-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-orange-400 tracking-tight">Abido</h1>
                    <div className="text-center space-y-1">
                        <h2 className="text-4xl font-extrabold text-white">
                            Welcome to <span className="text-pink-500">Abido AI</span>
                        </h2>
                        <p className="text-gray-400 text-lg font-medium max-w-[280px] mx-auto leading-tight mt-2">
                            Your fun 1-minute public speaking coach
                        </p>
                    </div>
                </div>
            )}

            {/* 2. MAIN INTERFACE CARD (Dark Mode) */}
            <div className="w-full bg-[#1c1c1e] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">

                {/* Error Banner - Always on top */}
                {error && (
                    <div className="absolute top-4 left-4 right-4 bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-200 text-sm flex items-start gap-2 animate-in slide-in-from-top z-50">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {/* State A: SELECTION SCREEN */}
                {!isRecording && !isLoading && !feedback && (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-white">Choose your recording duration</h3>
                            <p className="text-gray-400 text-sm">How long would you like to speak?</p>
                        </div>

                        {/* Duration Grid */}
                        <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
                            {[10, 20, 30, 45].map((time) => (
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
                                onClick={() => setSelectedDuration(60)}
                                className={`col-span-2 py-3 rounded-2xl font-semibold transition-all ${selectedDuration === 60
                                    ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                                    : "bg-[#2c2c2e] text-gray-400 hover:bg-[#3a3a3c]"
                                    }`}
                            >
                                60s (Recommended)
                            </button>
                        </div>

                        {/* Start Button */}
                        <button
                            onClick={startRecording}
                            className="w-full py-5 rounded-2xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xl shadow-xl shadow-pink-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95 mt-4"
                        >
                            <Mic className="h-6 w-6" /> Start Recording
                        </button>

                        <div className="bg-gray-800/50 px-4 py-1 rounded-full text-xs text-gray-500 font-mono mt-2">
                            🔒 We don't store your voice. Ever.
                        </div>
                    </div>
                )}

                {/* State B: RECORDING SCREEN */}
                {isRecording && (
                    <div className="flex flex-col items-center gap-8 py-6 animate-in fade-in">
                        <div className="relative">
                            <span className="absolute -inset-6 bg-pink-500/20 rounded-full animate-ping opacity-75"></span>
                            <div className="h-28 w-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-pink-500 z-10 relative">
                                <Mic className="h-12 w-12 text-pink-500" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-pink-400 font-bold tracking-widest uppercase text-xs animate-pulse">
                                Recording In Progress
                            </p>
                            <p className="text-6xl font-mono font-black text-white tabular-nums tracking-tighter">
                                {formatTime(recordingTime)}
                            </p>
                            <p className="text-sm text-gray-500 font-medium">Goal: {selectedDuration}s</p>

                            {/* Progress bar */}
                            <div className="w-full max-w-[200px] mx-auto mt-4">
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-1000 ease-linear"
                                        style={{ width: `${(recordingTime / selectedDuration) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={stopRecording}
                            className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all mt-4"
                        >
                            <Square className="h-5 w-5 fill-current" /> Stop & Analyze
                        </button>
                    </div>
                )}

                {/* State C: LOADING SCREEN */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in">
                        <Loader2 className="h-16 w-16 text-pink-500 animate-spin mb-6" />
                        <h3 className="text-2xl font-bold text-white mb-2">Analyzing...</h3>
                        <p className="text-gray-400 text-center px-4">Checking your confidence, filler words, and vibe.</p>
                        <p className="text-xs text-gray-600 mt-3">Powered by Gemini 3 Pro</p>
                    </div>
                )}

                {/* State D: RESULTS SCREEN */}
                {feedback && (
                    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">Your Results</h3>
                            <span className="bg-gray-800 text-xs font-mono py-1 px-2 rounded text-gray-400">AI Analysis</span>
                        </div>

                        {/* Confidence Score - Main Highlight */}
                        <div className="text-center py-2">
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Confidence Score</p>
                            <div className="flex items-center justify-center gap-2">
                                <p className={`text-7xl font-black ${getConfidenceColor(feedback.confidence_score)}`}>
                                    {feedback.confidence_score}
                                </p>
                                <span className="text-2xl text-gray-600 font-bold self-end mb-2">/100</span>
                            </div>
                            <p className={`text-sm font-bold mt-2 ${getConfidenceColor(feedback.confidence_score)}`}>
                                {getConfidenceLabel(feedback.confidence_score)}
                            </p>
                        </div>

                        {/* Coach's Feedback */}
                        <div className="bg-[#2c2c2e] p-5 rounded-2xl border-l-4 border-yellow-400">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-yellow-400" />
                                <span className="font-bold text-white text-sm">Coach's Feedback</span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                "{feedback.encouragement}"
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#2c2c2e] p-4 rounded-2xl">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Vibe</p>
                                <p className="text-lg font-bold text-white capitalize">{feedback.overall_vibe}</p>
                            </div>
                            <div className="bg-[#2c2c2e] p-4 rounded-2xl">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Energy</p>
                                <p className="text-lg font-bold text-white capitalize">{feedback.energy_level}</p>
                            </div>
                        </div>

                        {/* Filler Words Section */}
                        <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl">
                            <p className="text-xs text-orange-400 font-bold uppercase mb-2">Filler Words Detected</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-orange-400">{feedback.filler_count}</p>
                                <p className="text-sm text-gray-400">{feedback.filler_words}</p>
                            </div>
                        </div>

                        {/* Strengths & Improvements */}
                        <div className="space-y-3">
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl">
                                <p className="text-xs text-green-400 font-bold uppercase mb-2">✓ What You Did Well</p>
                                <p className="text-sm text-gray-300">{feedback.strength}</p>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl">
                                <p className="text-xs text-blue-400 font-bold uppercase mb-2">→ Next Step</p>
                                <p className="text-sm text-gray-300">{feedback.improvement_tip}</p>
                            </div>
                        </div>

                        {/* Try Again Button */}
                        <div className="pt-4">
                            <button
                                onClick={() => {
                                    setFeedback(null)
                                    setError("")
                                }}
                                className="w-full py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-md flex items-center justify-center gap-2 transition-colors shadow-lg shadow-pink-900/20"
                            >
                                <RefreshCw className="h-5 w-5" /> Try Another Recording
                            </button>
                        </div>

                        {/* Transcript */}
                        <details className="text-xs text-gray-500 cursor-pointer text-center">
                            <summary className="hover:text-gray-300 transition-colors font-bold">View Full Transcript</summary>
                            <p className="mt-2 text-left p-3 bg-black/30 rounded-lg italic text-gray-400 leading-relaxed">
                                "{feedback.transcript}"
                            </p>
                        </details>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-600 text-center mt-2">
                Powered by Gemini 3 Pro • Analysis is experimental
            </p>
        </div>
    )
}