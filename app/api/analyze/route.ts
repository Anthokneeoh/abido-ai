import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(request: Request) {
    try {
        // Parse form data to get audio file
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;

        // Validate audio file exists
        if (!audioFile) {
            return NextResponse.json(
                { error: "No audio file provided" },
                { status: 400 }
            );
        }

        console.log("Received audio file:", audioFile.size, "bytes");

        // Convert audio to base64 for Gemini API
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        // Configure Gemini model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.3,
                topP: 0.85,
                topK: 40,
            }
        });

        // Enhanced system prompt with validation, safety, and scoring
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

        console.log("Sending audio to Gemini API for analysis...");

        // Send to Gemini
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
        console.log("Raw API response preview:", responseText.substring(0, 200));

        // Clean JSON extraction
        let cleanJson = responseText.trim();

        // Remove markdown code blocks if present
        if (cleanJson.includes("```")) {
            cleanJson = cleanJson.replace(/```json\n?/g, "").replace(/```\n?$/g, "").replace(/```/g, "");
        }

        cleanJson = cleanJson.trim();

        // Parse JSON response
        let feedback;
        try {
            feedback = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error("JSON parsing failed. Raw text:", cleanJson);
            throw new Error("AI returned invalid JSON format");
        }

        // Validate all required fields exist
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
                console.error("Missing required field:", field);
                throw new Error(`AI response missing field: ${field}`);
            }
        }

        // Parse confidence score with proper NaN handling
        const rawScore = feedback.confidence_score;
        let finalScore = parseInt(rawScore);

        // Critical fix: Only use fallback if parse actually failed (NaN)
        if (isNaN(finalScore)) {
            console.warn("Score parsing failed, using conservative fallback");
            finalScore = 30; // Conservative fallback for unclear audio
        }

        // Ensure score is within valid range (0-100)
        feedback.confidence_score = Math.max(0, Math.min(100, finalScore));

        // Parse filler count
        feedback.filler_count = parseInt(feedback.filler_count) || 0;

        console.log("Analysis completed successfully:", {
            score: feedback.confidence_score,
            vibe: feedback.overall_vibe,
            fillers: feedback.filler_count,
            transcriptLength: feedback.transcript.length
        });

        return NextResponse.json(feedback);

    } catch (error: any) {
        console.error("System error during analysis:", error);

        // Return user-friendly error response
        return NextResponse.json(
            {
                error: "Analysis failed. Please try recording again.",
                details: error.message || "Unknown error",
                suggestion: "Record 30-90 seconds of clear speech in a quiet environment."
            },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: "Operational",
        model: "gemini-2.5-pro",
        version: "2.2-production",
        timestamp: new Date().toISOString(),
        ready_for_demo: true
    });
}