import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

interface StoryboardGenerationParams {
  idea: string;
  style: string;
  mood: string;
  cutsStyle: string;
  targetDuration: number;
  aspectRatio: string;
  cameraLanguage: string;
  pacing: string;
  visualEra: string;
  scriptLanguage?: string;
  model?: "gpt-5-nano" | "gpt-5";
}

interface GeneratedScene {
  sceneNumber: number;
  title: string;
  description: string;
  notes: string;
  imagePrompt: string;
  videoPrompt: string;
  suggestedDuration: number;
}

export async function generateStoryboard(params: StoryboardGenerationParams): Promise<GeneratedScene[]> {
  const scriptLanguage = params.scriptLanguage || "english";
  const languageInstruction = scriptLanguage === "arabic" 
    ? "IMPORTANT: Write ALL scene titles, descriptions, and notes in Arabic language. Image and video prompts should remain in English for AI generation compatibility."
    : "Write all content in English.";

  const systemPrompt = `You are a professional film director and cinematographer creating detailed storyboards for film production.

Given a film idea and production parameters, generate a scene-by-scene storyboard. Each scene should have:
1. A clear title
2. A detailed description of what happens in the scene
3. Technical notes (camera angles, lighting, composition)
4. An image prompt optimized for AI image generation
5. A video prompt optimized for AI video generation with motion descriptions
6. Suggested duration in seconds

CRITICAL RULES:
- ${languageInstruction}
- The total duration of all scenes combined should approximately equal the target duration
- Image prompts should be highly detailed and descriptive, focusing on composition, lighting, and visual elements
- Video prompts should include motion descriptions, camera movement, and timing details
- Scenes should flow logically and tell a cohesive story
- Match the specified style, mood, camera language, pacing, and visual era
- For ${params.cutsStyle} cuts: ${params.cutsStyle === 'hard' ? 'create distinct, separate scenes with clear breaks' : 'ensure smooth transitions between scenes'}
- Output ONLY valid JSON, no other text

Output format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title",
      "description": "What happens in this scene",
      "notes": "Camera angles, lighting notes, composition details",
      "imagePrompt": "Detailed image generation prompt with composition, lighting, mood",
      "videoPrompt": "Detailed video prompt including motion, camera movement, timing",
      "suggestedDuration": 5
    }
  ]
}`;

  const userPrompt = `Create a storyboard for this film idea:

IDEA: ${params.idea}

PRODUCTION PARAMETERS:
- Style: ${params.style}
- Mood: ${params.mood}
- Cuts Style: ${params.cutsStyle}
- Target Total Duration: ${params.targetDuration} seconds
- Aspect Ratio: ${params.aspectRatio}
- Camera Language: ${params.cameraLanguage}
- Pacing: ${params.pacing}
- Visual Era: ${params.visualEra}
- Script Language: ${scriptLanguage === "arabic" ? "Arabic (العربية)" : "English"}

Generate a detailed storyboard with appropriate number of scenes to match the target duration.`;

  try {
    const response = await openai.responses.create({
      model: params.model || "gpt-5-nano",
      input: `${systemPrompt}\n\n${userPrompt}`
    });

    const output = response.output_text?.trim() || "";
    
    let jsonOutput = output;
    if (output.includes("```json")) {
      const match = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonOutput = match[1];
      }
    } else if (output.includes("```")) {
      const match = output.match(/```\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonOutput = match[1];
      }
    }

    const parsed = JSON.parse(jsonOutput);
    
    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      throw new Error("Invalid storyboard format: missing scenes array");
    }

    return parsed.scenes.map((scene: any, index: number) => ({
      sceneNumber: index + 1,
      title: scene.title || `Scene ${index + 1}`,
      description: scene.description || "",
      notes: scene.notes || "",
      imagePrompt: scene.imagePrompt || scene.description,
      videoPrompt: scene.videoPrompt || scene.description,
      suggestedDuration: scene.suggestedDuration || Math.floor(params.targetDuration / parsed.scenes.length)
    }));

  } catch (error) {
    console.error("Error generating storyboard:", error);
    throw new Error(`Failed to generate storyboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function regenerateSceneText(
  scene: { title: string; description: string; notes: string },
  params: StoryboardGenerationParams,
  model: "gpt-5-nano" | "gpt-5" = "gpt-5-nano"
): Promise<{ title: string; description: string; notes: string }> {
  const systemPrompt = `You are a professional film director regenerating a scene description with new creative variations while maintaining the core concept.

Given a scene and production parameters, create a fresh variation of the scene description. Output ONLY valid JSON:

{
  "title": "Updated scene title",
  "description": "Updated scene description",
  "notes": "Updated technical notes"
}`;

  const userPrompt = `Regenerate this scene with fresh creative variations:

CURRENT SCENE:
Title: ${scene.title}
Description: ${scene.description}
Notes: ${scene.notes}

PRODUCTION PARAMETERS:
- Style: ${params.style}
- Mood: ${params.mood}
- Camera Language: ${params.cameraLanguage}
- Pacing: ${params.pacing}
- Visual Era: ${params.visualEra}

Provide a creative variation while maintaining the scene's purpose.`;

  try {
    const response = await openai.responses.create({
      model: model,
      input: `${systemPrompt}\n\n${userPrompt}`
    });

    const output = response.output_text?.trim() || "";
    
    let jsonOutput = output;
    if (output.includes("```json")) {
      const match = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonOutput = match[1];
      }
    }

    const parsed = JSON.parse(jsonOutput);
    
    return {
      title: parsed.title || scene.title,
      description: parsed.description || scene.description,
      notes: parsed.notes || scene.notes
    };

  } catch (error) {
    console.error("Error regenerating scene:", error);
    throw new Error(`Failed to regenerate scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function regenerateImagePrompt(
  currentPrompt: string,
  sceneContext: { title: string; description: string },
  params: StoryboardGenerationParams,
  model: "gpt-5-nano" | "gpt-5" = "gpt-5-nano"
): Promise<string> {
  const systemPrompt = `You are a professional storyboard artist creating detailed image prompts for AI storyboard frame generation.

Given a scene context and current image prompt, create a fresh creative variation for a STATIC STORYBOARD FRAME that:
- Focuses on composition, framing, and visual elements of a SINGLE FROZEN MOMENT
- Describes the visual layout, character positions, environment, and lighting
- Emphasizes spatial relationships, depth, and scene staging
- Is highly detailed and optimized for AI image generation
- NEVER describes motion, camera movement, transitions, or temporal sequences
- Captures a specific moment in time as a photograph or illustration would

Output ONLY the new image prompt as plain text, no JSON, no explanations.`;

  const userPrompt = `Regenerate this storyboard frame prompt with fresh creative variations:

SCENE CONTEXT:
Title: ${sceneContext.title}
Description: ${sceneContext.description}

CURRENT STORYBOARD FRAME PROMPT:
${currentPrompt}

PRODUCTION PARAMETERS:
- Style: ${params.style}
- Mood: ${params.mood}
- Visual Era: ${params.visualEra}

Create a new detailed image prompt for a static storyboard frame with fresh creative variations while maintaining the scene's visual concept. Focus on composition, framing, lighting, and the visual arrangement of elements in this frozen moment. Do NOT describe motion, camera movement, or temporal changes.`;

  try {
    const response = await openai.responses.create({
      model: model,
      input: `${systemPrompt}\n\n${userPrompt}`
    });

    const output = response.output_text?.trim() || "";
    return output || currentPrompt;

  } catch (error) {
    console.error("Error regenerating image prompt:", error);
    throw new Error(`Failed to regenerate image prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function regenerateVideoPrompt(
  currentPrompt: string,
  sceneContext: { title: string; description: string },
  params: StoryboardGenerationParams,
  model: "gpt-5-nano" | "gpt-5" = "gpt-5-nano"
): Promise<string> {
  const systemPrompt = `You are a professional cinematographer creating detailed video prompts for AI video generation.

Given a scene context and current video prompt, create a fresh creative variation that:
- Maintains the core motion and camera concept
- Adds new creative details about camera movement and timing
- Is highly detailed and optimized for AI video generation
- Focuses on motion, camera movement, transitions, and timing

Output ONLY the new video prompt as plain text, no JSON, no explanations.`;

  const userPrompt = `Regenerate this video prompt with fresh creative variations:

SCENE CONTEXT:
Title: ${sceneContext.title}
Description: ${sceneContext.description}

CURRENT VIDEO PROMPT:
${currentPrompt}

PRODUCTION PARAMETERS:
- Style: ${params.style}
- Mood: ${params.mood}
- Camera Language: ${params.cameraLanguage}
- Pacing: ${params.pacing}
- Visual Era: ${params.visualEra}

Create a new detailed video prompt with fresh creative variations, including camera movements, timing, and visual transitions.`;

  try {
    const response = await openai.responses.create({
      model: model,
      input: `${systemPrompt}\n\n${userPrompt}`
    });

    const output = response.output_text?.trim() || "";
    return output || currentPrompt;

  } catch (error) {
    console.error("Error regenerating video prompt:", error);
    throw new Error(`Failed to regenerate video prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
