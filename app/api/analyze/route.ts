import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini 2.5 Pro
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(request: Request) {
    try {
        // Get audio file from request
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: "No audio file provided" },
                { status: 400 }
            );
        }

        console.log("Received audio file:", audioFile.size, "bytes");

        // Convert audio to base64 for Gemini
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        // Use Gemini 2.5 Pro 
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.7, // Balanced creativity
                topP: 0.8,
                topK: 40,
            }
        });


        const prompt = `
You are 'Abido', an expert public speaking coach.

PHASE 1: THE SILENCE GATEKEEPER
First, listen to the audio file.
IF the audio is mostly silence, background noise, music, or unintelligible mumbling:
- Return a JSON with "confidence_score": 0
- Set "transcript" to: "[No clear speech detected. Please speak closer to the microphone.]"
- Set "overall_vibe" to "Unclear"
- Set "encouragement" to "I couldn't hear you clearly. Try recording again in a quiet place."
- Stop analysis here.

PHASE 2: RIGOROUS ANALYSIS (If speech is detected)
Evaluate the speech based on these 6 DIMENSIONS from the expert criteria:
1. Confidence (Vocal steadiness, lack of self-undermining)
2. Pace (Timing, rhythm, flow)
3. Filler Words (Frequency based on the FULL FILLER WORDS LIST below)
4. Clarity (Articulation, intelligibility)
5. Message Strength (Logic and structure)
6. Authority (Command of the room)

PHASE 3: OUTPUT GENERATION (Strict JSON)
Map your deep analysis to this exact JSON structure required by the app.

CRITICAL TRANSCRIPTION RULE:
- The "transcript" field must be VERBATIM. 
- Write exactly what was said word-for-word.
- DO NOT SUMMARIZE. DO NOT TRUNCATE. Catch every single filler word in the list.

FILLER WORDS LIST: um, uh, like, you know, so, actually, yeah, basically, literally, kind of, sort of, I mean, right, okay, well, sha, abi

OUTPUT FORMAT (JSON Only):
{
  "transcript": "Full word-for-word text here...",
  "confidence_score": number (Calculate an overall 0-100 score based on Confidence + Authority dimensions),
  "overall_vibe": "One of: Confident | Nervous | Natural | Rushed | Monotone | Enthusiastic",
  "energy_level": "High | Medium | Low",
  "filler_words": "List detected fillers (e.g., 'um (2), like (1)')",
  "filler_count": number (Total integer count of fillers),
  "strength": "The single strongest aspect based on the 6 dimensions",
  "improvement_tip": "The most urgent thing to fix (derived from the lowest scoring dimension)",
  "encouragement": "IF SCORE < 50: Be extra supportive and kind (e.g., 'Don't worry, even pros start here. Fixing this one habit will double your score next time.'). IF SCORE > 50: Direct, grounded feedback."
}
`;

        console.log("Sending to Gemini 2.5 Pro...");

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "audio/webm",
                    data: base64Audio,
                },
            },
        ]);

        const responseText = result.response.text();

        let cleanJson = responseText.trim();
        if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        }
        cleanJson = cleanJson.trim();

        const feedback = JSON.parse(cleanJson);

        // Validation & Fallbacks
        feedback.confidence_score = parseInt(feedback.confidence_score) || 50;
        feedback.filler_count = parseInt(feedback.filler_count) || 0;

        return NextResponse.json(feedback);

    } catch (error: any) {
        console.error("Gemini 2.5 Pro Error:", error);
        return NextResponse.json(
            {
                error: "Analysis failed. Please try again with a 30-90 seconds recording.",
                details: error.message || "Unknown error",
                suggestion: "Speak clearly for at least 30 seconds. Ensure microphone is working."
            },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: "ok",
        model: "gemini-2.5-pro",
        timestamp: new Date().toISOString()
    });
}