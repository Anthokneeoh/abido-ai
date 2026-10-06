import { NextResponse } from "next/server";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs";

const apiKey = process.env.NOVITA_API_KEY;

const MODEL = "xiaomimimo/mimo-v2.6-flash";
const NOVITA_URL = "https://api.novita.ai/openai/v1/chat/completions";
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const REQUEST_TIMEOUT = 30000;

if (!apiKey) {
    console.error("Missing NOVITA_API_KEY environment variable");
}

/**
 * Convert browser-recorded WebM/Opus audio to WAV.
 *
 * MiMo expects supported audio such as WAV/MP3.
 * Browser MediaRecorder commonly produces audio/webm,
 * so we normalize everything to 16 kHz mono PCM WAV.
 */
async function convertToWav(input: Buffer): Promise<Buffer> {
    if (!ffmpegPath) {
        throw new Error("FFmpeg binary is not available");
    }

    const executablePath = ffmpegPath;

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(executablePath, [
            "-hide_banner",
            "-loglevel",
            "error",

            // Read WebM/Opus from stdin
            "-i",
            "pipe:0",

            // Normalize audio
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",

            // Output WAV to stdout
            "-f",
            "wav",
            "pipe:1",
        ]);

        const outputChunks: Buffer[] = [];
        const errorChunks: Buffer[] = [];

        ffmpeg.stdout.on("data", (chunk: Buffer) => {
            outputChunks.push(chunk);
        });

        ffmpeg.stderr.on("data", (chunk: Buffer) => {
            errorChunks.push(chunk);
        });

        ffmpeg.on("error", (error) => {
            reject(error);
        });

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve(Buffer.concat(outputChunks));
                return;
            }

            const errorMessage = Buffer.concat(errorChunks)
                .toString("utf8")
                .trim();

            reject(
                new Error(
                    `FFmpeg conversion failed${errorMessage ? `: ${errorMessage}` : ""}`
                )
            );
        });

        ffmpeg.stdin.on("error", (error: NodeJS.ErrnoException) => {
            // Ignore EPIPE because FFmpeg may close stdin after a conversion error.
            if (error.code !== "EPIPE") {
                reject(error);
            }
        });

        ffmpeg.stdin.end(input);
    });
}

export async function POST(request: Request) {
    try {
        // 1. Validate API key
        if (!apiKey) {
            return NextResponse.json(
                {
                    error: "Server configuration error",
                    details: "NOVITA_API_KEY is not configured",
                },
                { status: 500 }
            );
        }

        // 2. Parse form data
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json(
                { error: "No audio file provided" },
                { status: 400 }
            );
        }

        // 3. Validate file size
        if (audioFile.size > MAX_AUDIO_SIZE) {
            return NextResponse.json(
                {
                    error: "Audio file too large (max 10 MB)",
                },
                { status: 400 }
            );
        }

        // 4. Validate MIME type
        const mimeType = audioFile.type || "audio/webm";

        if (!mimeType.startsWith("audio/")) {
            return NextResponse.json(
                {
                    error: "Invalid file type",
                    details: `Received: ${mimeType}`,
                },
                { status: 400 }
            );
        }

        console.log(
            `Received audio: ${audioFile.size} bytes, type: ${mimeType}`
        );

        // 5. Read browser audio
        const arrayBuffer = await audioFile.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // 6. Convert browser WebM audio to WAV
        console.log("Converting audio to WAV...");

        const wavBuffer = await convertToWav(inputBuffer);

        console.log(
            `Audio converted successfully: ${wavBuffer.length} bytes WAV`
        );

        // 7. Convert WAV to base64
        const base64Audio = wavBuffer.toString("base64");

        const prompt = `
# ABIDO AI - SPEECH ANALYSIS SYSTEM v2.2

## YOUR ROLE

You are Abido, an expert public speaking coach. Analyze speech objectively using measurable criteria.

---

## PHASE 1: AUDIO VALIDATION

**Listen to the audio first. Then check these conditions IN ORDER:**

### CONDITION 1: SILENCE / NO SPEECH

IF the audio contains:

- Less than 10 seconds of human speech
- Only silence, static, or background noise
- No intelligible words

RETURN THIS JSON:

{
  "transcript": "[No speech detected]",
  "confidence_score": 0,
  "overall_vibe": "Unclear",
  "energy_level": "Low",
  "filler_words": "N/A",
  "filler_count": 0,
  "strength": "Unable to analyze",
  "improvement_tip": "Record for at least 10 seconds in a quiet environment.",
  "encouragement": "I couldn't hear any speech. Please try again in a quieter place and speak clearly into your microphone."
}

STOP HERE.

---

### CONDITION 2: PROFANITY / OFFENSIVE CONTENT

IF the audio contains:

- Hate speech, slurs, or threats
- Heavy profanity (f*ck, sh*t, b*tch used aggressively)
- Sexually explicit content

RETURN THIS JSON:

{
  "transcript": "[Content flagged]",
  "confidence_score": 0,
  "overall_vibe": "Inappropriate",
  "energy_level": "N/A",
  "filler_words": "N/A",
  "filler_count": 0,
  "strength": "N/A",
  "improvement_tip": "Please record appropriate content for speech analysis.",
  "encouragement": "This content cannot be analyzed. Professional speech coaching requires respectful language."
}

STOP HERE.

---

### CONDITION 3: UNCLEAR AUDIO (BUT HAS SOME SPEECH)

IF the audio has speech BUT is:

- Mostly mumbled or distorted
- Very hard to understand (clarity score < 3/10)
- Heavy background noise drowning speech

RETURN THIS JSON:

{
  "transcript": "[Partially unclear - here's what I could hear: ...]",
  "confidence_score": 25,
  "overall_vibe": "Unclear",
  "energy_level": "Low",
  "filler_words": "[any detected]",
  "filler_count": [number],
  "strength": "Attempted to communicate despite poor audio conditions.",
  "improvement_tip": "Record in a quieter space with better microphone positioning. Speak directly into your device.",
  "encouragement": "I could hear you trying, but the audio quality made analysis difficult. Try again in a quieter environment for better feedback."
}

STOP HERE.

---

## PHASE 2: FULL ANALYSIS (If audio is clear and appropriate)

Analyze using these 6 dimensions (score each 1-10):

### 1. VOCAL CONFIDENCE (1-10)

- 9-10: Rock-solid, zero hesitation
- 7-8: Strong with minor pauses
- 5-6: Noticeable uncertainty
- 3-4: Frequent hesitation
- 1-2: Barely audible

### 2. PACING & RHYTHM (1-10)

- 9-10: Perfect cadence
- 7-8: Good flow, minor issues
- 5-6: Too fast or slow
- 3-4: Choppy delivery
- 1-2: Unintelligible speed

### 3. FILLER WORD FREQUENCY (1-10)

COUNT THESE: um, uh, like, you know, so, actually, basically, literally, kind of, sort of, I mean, right, okay, well, sha, abi, yeah

SCORING:

- 10: 0 fillers
- 9-10: 1-2 fillers
- 7-8: 3-5 fillers
- 5-6: 6-10 fillers
- 3-4: 11-15 fillers
- 1-2: 16+ fillers

### 4. CLARITY & ARTICULATION (1-10)

- 9-10: Crystal clear
- 7-8: Mostly clear
- 5-6: Some unclear words
- 3-4: Hard to understand
- 1-2: Unintelligible

### 5. MESSAGE STRUCTURE (1-10)

- 9-10: Clear beginning/middle/end
- 7-8: Good flow, minor tangents
- 5-6: Somewhat scattered
- 3-4: Confusing
- 1-2: No clear message

### 6. VOCAL AUTHORITY (1-10)

- 9-10: Commands attention
- 7-8: Solid presence
- 5-6: Average
- 3-4: Lacks command
- 1-2: Timid

---

## PHASE 3: SCORE CALCULATION

Formula:

confidence_score = (
  (Vocal_Confidence × 2.0) +
  (Pacing × 1.5) +
  (Filler_Score × 1.0) +
  (Clarity × 2.0) +
  (Message × 1.5) +
  (Authority × 2.0)
) ÷ 10

Map to overall_vibe:

- 85-100: "Confident" or "Enthusiastic"
- 70-84: "Natural"
- 55-69: "Nervous"
- 40-54: "Rushed"
- 0-39: "Monotone"

Energy level:

- High = Projected, dynamic
- Medium = Conversational
- Low = Quiet, flat

---

## PHASE 4: OUTPUT FORMAT

Return ONLY this JSON (no markdown, no extra text):

{
  "transcript": "Exact word-for-word transcription here. DO NOT SUMMARIZE.",
  "confidence_score": 75,
  "overall_vibe": "Natural",
  "energy_level": "Medium",
  "filler_words": "um (3), like (2), you know (1)",
  "filler_count": 6,
  "strength": "Your [dimension] was strong because [specific observation].",
  "improvement_tip": "Focus on reducing [specific issue]. Try [actionable technique].",
  "encouragement": "[See rules below]"
}

---

## ENCOURAGEMENT RULES

IF confidence_score < 50:

"Great start! Every expert started where you are. Focus on [one fix] and you'll see huge improvement."

IF confidence_score 50-75:

"Solid foundation. Your [strength] is working well. Now polish [weakness] to level up."

IF confidence_score > 75:

"Strong delivery! You're ready for high-stakes presentations. To reach elite level, refine your [area]."

---

## CRITICAL RULES

1. VERBATIM TRANSCRIPTS - Never summarize
2. EXACT FILLER COUNTS - Count every occurrence
3. OBJECTIVE SCORING - Base on behavior, not personality
4. NO ASSUMPTIONS - Never mention age, gender, ethnicity
5. ONE CLEAR TIP - Don't overwhelm with fixes

---

Now analyze the audio and return ONLY the JSON response.
`;

        // 8. Build OpenAI-compatible Novita request
        //
        // IMPORTANT:
        // MiMo expects raw base64 audio here, not a data URL.
        // The audio has already been normalized to WAV.
        const requestBody = {
            model: MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt,
                        },
                        {
                            type: "input_audio",
                            input_audio: {
                                data: base64Audio,
                                format: "wav",
                            },
                        },
                    ],
                },
            ],
            temperature: 0.3,
            top_p: 0.85,
            response_format: {
                type: "json_object",
            },
        };

        console.log("Sending audio to Novita:", {
            model: MODEL,
            originalMimeType: mimeType,
            originalSize: audioFile.size,
            wavSize: wavBuffer.length,
            audioFormat: "wav",
        });

        // 9. Call Novita with a real request timeout
        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT);

        let novitaResponse: Response;

        try {
            novitaResponse = await fetch(NOVITA_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });
        } catch (error: any) {
            if (error?.name === "AbortError") {
                throw new Error("Request timeout");
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        // 10. Read response body
        const responseText = await novitaResponse.text();

        let responseBody: any;

        try {
            responseBody = responseText ? JSON.parse(responseText) : null;
        } catch {
            responseBody = responseText;
        }

        // 11. Handle Novita API errors
        if (!novitaResponse.ok) {
            console.error("Novita API request failed:", {
                status: novitaResponse.status,
                statusText: novitaResponse.statusText,
                body: responseBody,
            });

            throw new Error(
                responseBody?.error?.message ||
                responseBody?.message ||
                `Novita API request failed with status ${novitaResponse.status}`
            );
        }

        // 12. Extract model response
        const responseContent =
            responseBody?.choices?.[0]?.message?.content;

        if (!responseContent) {
            console.error("Unexpected Novita response:", responseBody);

            throw new Error("Empty response from Novita AI");
        }

        console.log(
            "Raw API response preview:",
            String(responseContent).substring(0, 200)
        );

        // 13. Clean JSON
        let cleanJson = String(responseContent).trim();

        if (cleanJson.includes("```")) {
            cleanJson = cleanJson
                .replace(/```json\s*/gi, "")
                .replace(/```\s*$/g, "")
                .trim();
        }

        // 14. Parse JSON
        let feedback: any;

        try {
            feedback = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error(
                "JSON parsing failed. Raw model response:",
                cleanJson
            );

            throw new Error("AI returned invalid JSON format");
        }

        // 15. Validate required fields
        const requiredFields = [
            "transcript",
            "confidence_score",
            "overall_vibe",
            "energy_level",
            "filler_words",
            "filler_count",
            "strength",
            "improvement_tip",
            "encouragement",
        ];

        for (const field of requiredFields) {
            if (!(field in feedback)) {
                console.error("Missing required field:", field);

                throw new Error(`AI response missing field: ${field}`);
            }
        }

        // 16. Sanitize numeric fields
        let finalScore = parseInt(feedback.confidence_score, 10);

        if (Number.isNaN(finalScore)) {
            console.warn(
                "Score parsing failed, using conservative fallback"
            );

            finalScore = 30;
        }

        feedback.confidence_score = Math.max(
            0,
            Math.min(100, finalScore)
        );

        const fillerCount = parseInt(feedback.filler_count, 10);

        feedback.filler_count = Number.isNaN(fillerCount)
            ? 0
            : Math.max(0, fillerCount);

        console.log("Analysis completed:", {
            score: feedback.confidence_score,
            vibe: feedback.overall_vibe,
            fillers: feedback.filler_count,
        });

        // 17. Return final analysis
        return NextResponse.json(feedback);
    } catch (error: any) {
        console.error("System error during analysis:", error);

        if (error?.message === "Request timeout") {
            return NextResponse.json(
                {
                    error: "Request timeout",
                    details:
                        "The speech analysis service took too long to respond.",
                },
                { status: 504 }
            );
        }

        return NextResponse.json(
            {
                error: "Analysis failed. Please try recording again.",
                details: error?.message || "Unknown error",
                suggestion:
                    "Record 30-90 seconds of clear speech in a quiet environment.",
            },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: "Operational",
        model: MODEL,
        provider: "Novita AI",
        version: "2.3-mimo-audio",
        timestamp: new Date().toISOString(),
        ready_for_demo: true,
    });
}