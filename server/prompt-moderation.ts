import OpenAI from "openai";
import { getConfig } from "./site-config";
import { storage } from "./storage";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

export type ModerationVerdict = "ALLOW" | "ALLOW_WITH_REWRITE" | "BLOCK" | "ESCALATE";

export interface ModerationResult {
  verdict: ModerationVerdict;
  reasons: string[];
  policy_tags: string[];
  safe_rewrite: string;
}

export interface ModerationResponse {
  allowed: boolean;
  verdict: ModerationVerdict;
  originalPrompt: string;
  finalPrompt: string;
  appliedRewrite: boolean;
  reasons: string[];
  policyTags: string[];
  error?: {
    code: string;
    message: string;
    policyTags: string[];
    reasons: string[];
  };
}

export const DEFAULT_MODERATION_SYSTEM_PROMPT = `SYSTEM: You are Tkoeen Prompt Moderator for Saudi/GCC cultural safety. Review the user prompt and return JSON only.
Return JSON:
{
  "verdict":"ALLOW|ALLOW_WITH_REWRITE|BLOCK|ESCALATE",
  "reasons":["..."],
  "policy_tags":["..."],
  "safe_rewrite":"..."
}

Verdicts:
- ALLOW: safe as-is
- ALLOW_WITH_REWRITE: can be made safe with small edits (keep intent)
- BLOCK: core intent is disallowed (do NOT rewrite into same disallowed intent)
- ESCALATE: unclear/borderline religion/politics → human review
Rules (Saudi-focused):
1) Religion (STRICT): BLOCK any mockery/insults/derogatory content about Islam or any religion/sects/prophets/holy books/rituals, or disrespect of holy sites (Kaaba, Masjid al-Haram). Tag: RELIGION_OFFENSE
2) Nudity & sexual (STRICT): BLOCK any nudity, porn, fetish, explicit sexual content, sexual services, kissing, romantic touching, or intimate physical contact. Any sexual content involving minors = instant BLOCK. Tags: NUDITY, SEXUAL_CONTENT, MINOR_SAFETY
3) Same-sex romantic content (STRICT): BLOCK any same-sex romantic content, LGBTQ+ themes, same-sex kissing, couples, or relationships. This content is illegal and culturally prohibited in Saudi Arabia. Tag: LGBTQ_CONTENT
4) Political figures (Saudi-sensitive): BLOCK insults/defamation/offensive depictions of political figures, especially Saudi leaders/officials. If it names a Saudi political figure in a sensitive scenario or intent is unclear → ESCALATE. Tag: POLITICAL_FIGURE
5) Hate/harassment: BLOCK slurs, sectarian/tribal/racist hate, dehumanization, targeted harassment or humiliation. Tag: HATE_SPEECH
6) Cultural disrespect: BLOCK content that ridicules Saudi culture/national symbols or aims to provoke social offense. Tag: CULTURAL_DISRESPECT
7) Romantic/sensual content: BLOCK or REWRITE any romantic gestures between unmarried people, sensual poses, revealing clothing, or suggestive content. For married couples, keep modest. Tag: ROMANTIC_CONTENT
Rewrite rules (ALLOW_WITH_REWRITE only):
- Remove/replace offending terms; keep creative intent.
- Enforce modesty (no revealing clothing, no sensual focus, no kissing or intimate touching).
- Replace real political figures with fictional/general roles.
- Convert romantic scenes to modest, family-friendly versions.
If the prompt's core intent is disallowed (religion hate, porn/sexual, LGBTQ, defaming leaders, hate speech) → BLOCK and leave safe_rewrite empty.`;

function parseModerationResult(text: string): ModerationResult {
  let jsonText = text.trim();
  
  if (jsonText.includes("```json")) {
    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1];
    }
  } else if (jsonText.includes("```")) {
    const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1];
    }
  }
  
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonText);
    
    const verdict = ["ALLOW", "ALLOW_WITH_REWRITE", "BLOCK", "ESCALATE"].includes(parsed.verdict) 
      ? parsed.verdict as ModerationVerdict
      : "BLOCK";
    
    return {
      verdict,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      policy_tags: Array.isArray(parsed.policy_tags) ? parsed.policy_tags : [],
      safe_rewrite: typeof parsed.safe_rewrite === "string" ? parsed.safe_rewrite : ""
    };
  } catch (error) {
    console.error("Failed to parse moderation result:", error, "Raw text:", text);
    return {
      verdict: "BLOCK",
      reasons: ["Moderation parse error"],
      policy_tags: ["PARSE_ERROR"],
      safe_rewrite: ""
    };
  }
}

export function isModerationEnabled(): boolean {
  const value = getConfig("moderation_enabled", true);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return true;
}

export function getModerationSystemPrompt(): string {
  const customPrompt = getConfig("moderation_system_prompt", null);
  if (customPrompt && typeof customPrompt === "string" && customPrompt.trim().length > 0) {
    return customPrompt;
  }
  return DEFAULT_MODERATION_SYSTEM_PROMPT;
}

export async function moderatePrompt(
  prompt: string,
  negativePrompt?: string,
  stylePreset?: string,
  userId?: string
): Promise<ModerationResponse> {
  if (!isModerationEnabled()) {
    return {
      allowed: true,
      verdict: "ALLOW",
      originalPrompt: prompt,
      finalPrompt: prompt,
      appliedRewrite: false,
      reasons: [],
      policyTags: []
    };
  }

  let combinedPrompt = prompt;
  if (negativePrompt) {
    combinedPrompt += `\n\n[Negative Prompt]: ${negativePrompt}`;
  }
  if (stylePreset) {
    combinedPrompt += `\n\n[Style Preset]: ${stylePreset}`;
  }

  try {
    console.log("[Moderation] Checking prompt:", combinedPrompt.substring(0, 200) + "...");
    
    const systemPrompt = getModerationSystemPrompt();
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `${systemPrompt}\n\nUser prompt to moderate:\n${combinedPrompt}`
    });

    const outputText = response.output_text?.trim() || "";
    const result = parseModerationResult(outputText);
    
    console.log(`[Moderation] Verdict: ${result.verdict}, Tags: ${result.policy_tags.join(", ")}`);

    await logModerationEvent(
      userId || "anonymous",
      prompt,
      negativePrompt,
      result.verdict,
      result.policy_tags,
      result.reasons,
      result.safe_rewrite
    );

    switch (result.verdict) {
      case "ALLOW":
        return {
          allowed: true,
          verdict: "ALLOW",
          originalPrompt: prompt,
          finalPrompt: prompt,
          appliedRewrite: false,
          reasons: result.reasons,
          policyTags: result.policy_tags
        };

      case "ALLOW_WITH_REWRITE":
        const rewrittenPrompt = result.safe_rewrite || prompt;
        return {
          allowed: true,
          verdict: "ALLOW_WITH_REWRITE",
          originalPrompt: prompt,
          finalPrompt: rewrittenPrompt,
          appliedRewrite: true,
          reasons: result.reasons,
          policyTags: result.policy_tags
        };

      case "BLOCK":
        return {
          allowed: false,
          verdict: "BLOCK",
          originalPrompt: prompt,
          finalPrompt: "",
          appliedRewrite: false,
          reasons: result.reasons,
          policyTags: result.policy_tags,
          error: {
            code: "PROMPT_BLOCKED",
            message: "Your prompt violates our content policy.",
            policyTags: result.policy_tags,
            reasons: result.reasons
          }
        };

      case "ESCALATE":
        return {
          allowed: false,
          verdict: "ESCALATE",
          originalPrompt: prompt,
          finalPrompt: "",
          appliedRewrite: false,
          reasons: result.reasons,
          policyTags: result.policy_tags,
          error: {
            code: "PROMPT_NEEDS_REVIEW",
            message: "Your prompt needs review before it can be processed.",
            policyTags: result.policy_tags,
            reasons: result.reasons
          }
        };

      default:
        return {
          allowed: false,
          verdict: "BLOCK",
          originalPrompt: prompt,
          finalPrompt: "",
          appliedRewrite: false,
          reasons: ["Unknown moderation verdict"],
          policyTags: ["UNKNOWN_VERDICT"],
          error: {
            code: "PROMPT_BLOCKED",
            message: "Your prompt could not be processed.",
            policyTags: ["UNKNOWN_VERDICT"],
            reasons: ["Unknown moderation verdict"]
          }
        };
    }
  } catch (error) {
    console.error("[Moderation] Error during moderation:", error);
    
    await logModerationEvent(
      userId || "anonymous",
      prompt,
      negativePrompt,
      "BLOCK",
      ["MODERATION_ERROR"],
      ["Moderation service error"],
      ""
    );
    
    return {
      allowed: false,
      verdict: "BLOCK",
      originalPrompt: prompt,
      finalPrompt: "",
      appliedRewrite: false,
      reasons: ["Moderation service error"],
      policyTags: ["MODERATION_ERROR"],
      error: {
        code: "MODERATION_ERROR",
        message: "Content moderation service is temporarily unavailable. Please try again.",
        policyTags: ["MODERATION_ERROR"],
        reasons: ["Moderation service error"]
      }
    };
  }
}

async function logModerationEvent(
  userId: string,
  prompt: string,
  negativePrompt: string | undefined,
  verdict: ModerationVerdict,
  policyTags: string[],
  reasons: string[],
  safeRewrite: string
): Promise<void> {
  try {
    await storage.createModerationLog({
      userId,
      prompt,
      negativePrompt: negativePrompt || null,
      verdict,
      policyTags,
      reasons,
      safeRewrite: safeRewrite || null
    });
  } catch (error) {
    console.error("[Moderation] Failed to log moderation event:", error);
  }
}

export function buildModerationErrorResponse(moderationResult: ModerationResponse): {
  status: number;
  body: any;
} {
  if (moderationResult.verdict === "BLOCK") {
    return {
      status: 403,
      body: {
        error: {
          code: "PROMPT_BLOCKED",
          message: "Your prompt violates our content policy.",
          policyTags: moderationResult.policyTags,
          reasons: moderationResult.reasons
        }
      }
    };
  }
  
  if (moderationResult.verdict === "ESCALATE") {
    return {
      status: 403,
      body: {
        error: {
          code: "PROMPT_NEEDS_REVIEW",
          message: "Your prompt needs review before it can be processed.",
          policyTags: moderationResult.policyTags,
          reasons: moderationResult.reasons
        }
      }
    };
  }
  
  return {
    status: 200,
    body: {}
  };
}

export function addModerationMetadata(response: any, moderationResult: ModerationResponse): any {
  if (moderationResult.appliedRewrite) {
    return {
      ...response,
      moderation: {
        appliedRewrite: true,
        originalPrompt: moderationResult.originalPrompt,
        rewrittenPrompt: moderationResult.finalPrompt
      }
    };
  }
  return response;
}
