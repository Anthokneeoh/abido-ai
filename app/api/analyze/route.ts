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

        // Use Gemini 2.5 Pro (most advanced model with better audio analysis)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.7, // Balanced creativity
                topP: 0.8,
                topK: 40,
            }
        });

        // Enhanced prompt for Gemini 2.5 Pro's superior audio analysis
        const prompt = `
You are an expert public speaking coach analyzing a speech recording for the Abido AI app.

CRITICAL: Your analysis must be accurate and based ONLY on what you actually hear in the audio.

TASK 1: TRANSCRIPTION
- Write exactly what you hear, word-for-word
- Include ALL filler words (um, uh, like, you know, so, actually, basically, literally)
- Maintain the speaker's exact phrasing

TASK 2: ANALYSIS
Analyze these aspects:
1. CONFIDENCE: Vocal strength, hesitation, assertiveness (0-100 scale)
   - 85-100: Very confident, strong delivery
   - 70-84: Good confidence with minor hesitations
   - 50-69: Moderate confidence, some uncertainty
   - 30-49: Low confidence, frequent hesitation
   - 0-29: Very nervous or unclear

2. FILLER WORDS: Count EACH occurrence of: um, uh, like, you know, so, actually, basically, literally, kind of, sort of

3. OVERALL VIBE: Choose the most accurate descriptor
   - Confident: Strong, assured, clear delivery
   - Nervous: Hesitant, shaky, uncertain
   - Natural: Conversational, comfortable, authentic
   - Rushed: Too fast, hard to follow
   - Monotone: Flat, lacks energy
   - Enthusiastic: High energy, engaging

4. ENERGY LEVEL: Choose ONE: High | Medium | Low

5. STRENGTHS: Identify ONE specific thing they did well

6. IMPROVEMENT: Give ONE actionable tip

7. ENCOURAGEMENT: Write 1-2 sentences of genuine, specific encouragement

IMPORTANT RULES:
- Base confidence_score on ACTUAL vocal qualities you hear
- Count filler words accurately - don't guess
- If audio is too short (under 5 seconds), note this in feedback
- If audio is unclear, mention it
- Be honest but supportive

OUTPUT FORMAT (strict JSON, no markdown):
{
  "transcript": "exact transcription here",
  "confidence_score": 75,
  "overall_vibe": "Confident",
  "energy_level": "Medium",
  "filler_words": "um (2), like (3), you know (1)",
  "filler_count": 6,
  "strength": "specific strength observed",
  "improvement_tip": "one actionable improvement",
  "encouragement": "encouraging message based on actual performance"
}

Now analyze this speech recording:
`;

        console.log("Sending to Gemini 2.5 Pro...");

        // Send to Gemini 2.5 Pro
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "audio/webm",
                    data: base64Audio,
                },
            },
        ]);

        // Parse response
        const responseText = result.response.text();
        console.log("Raw response:", responseText.substring(0, 200) + "...");

        // Clean JSON from markdown formatting
        let cleanJson = responseText.trim();

        // Remove markdown code blocks if present
        if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        }

        cleanJson = cleanJson.trim();

        // Parse and validate
        const feedback = JSON.parse(cleanJson);

        // Validate required fields
        const requiredFields = [
            "transcript",
            "confidence_score",
            "overall_vibe",
            "energy_level",
            "filler_words",
            "filler_count",
            "strength",
            "improvement_tip",
            "encouragement"
        ];

        for (const field of requiredFields) {
            if (!(field in feedback)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Ensure confidence_score is a number
        feedback.confidence_score = parseInt(feedback.confidence_score);
        if (isNaN(feedback.confidence_score)) {
            feedback.confidence_score = 50; // Default fallback
        }

        // Ensure filler_count is a number
        feedback.filler_count = parseInt(feedback.filler_count);
        if (isNaN(feedback.filler_count)) {
            feedback.filler_count = 0; // Default fallback
        }

        console.log("Analysis successful:", {
            confidence: feedback.confidence_score,
            fillers: feedback.filler_count,
            vibe: feedback.overall_vibe
        });

        return NextResponse.json(feedback);

    } catch (error: any) {
        console.error("Gemini 2.5 Pro Error:", error);

        // Return detailed error for debugging
        return NextResponse.json(
            {
                error: "Analysis failed. Please try again with a 10-60 second recording.",
                details: error.message || "Unknown error",
                suggestion: "Speak clearly for at least 10 seconds. Ensure microphone is working."
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