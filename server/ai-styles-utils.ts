import { storage } from "./storage";
import type { InsertAiStyle } from "@shared/schema";

export const DEFAULT_AI_STYLES: { [key: string]: Omit<InsertAiStyle, "updatedBy"> } = {
  realistic: {
    name: "Realistic",
    promptText: "photorealistic, high detail, ultra sharp, natural lighting, realistic colors",
    category: "photorealistic",
    isVisible: true,
    sortOrder: 1,
  },
  concept_art: {
    name: "Concept Art",
    promptText: "concept art, cinematic, dramatic lighting, imaginative, fantasy setting",
    category: "artistic",
    isVisible: true,
    sortOrder: 2,
  },
  anime: {
    name: "Anime",
    promptText: "anime style, bold outlines, big expressive eyes, colorful, dynamic action",
    category: "artistic",
    isVisible: true,
    sortOrder: 3,
  },
  cyberpunk: {
    name: "Cyberpunk",
    promptText: "cyberpunk style, neon lights, futuristic cityscape, high tech, dark and vibrant",
    category: "artistic",
    isVisible: true,
    sortOrder: 4,
  },
  vintage: {
    name: "Vintage",
    promptText: "vintage style, retro, nostalgic, faded colors, classic design, old photograph look",
    category: "artistic",
    isVisible: true,
    sortOrder: 5,
  },
  sketch: {
    name: "Sketch",
    promptText: "sketch, pencil drawing, monochrome, hand-drawn lines, minimalist detail",
    category: "artistic",
    isVisible: true,
    sortOrder: 6,
  },
  surrealism: {
    name: "Surrealism",
    promptText: "surrealism, dreamlike, unexpected juxtapositions, imaginative, abstract elements",
    category: "artistic",
    isVisible: true,
    sortOrder: 7,
  },
  low_poly: {
    name: "Low Poly",
    promptText: "low poly art, geometric shapes, minimal detail, blocky design, colorful polygons",
    category: "design",
    isVisible: true,
    sortOrder: 8,
  },
  minimalist: {
    name: "Minimalist",
    promptText: "minimalist design, clean lines, simple shapes, limited color palette, modern aesthetic",
    category: "design",
    isVisible: true,
    sortOrder: 9,
  },
  paper_cutout: {
    name: "Paper Cutout",
    promptText: "paper cutout style, layered paper, handcrafted look, shadow effects, textured edges",
    category: "artistic",
    isVisible: true,
    sortOrder: 10,
  },
  cartoon: {
    name: "Cartoon",
    promptText: "cartoon style, bright colors, bold outlines, playful characters, cheerful mood",
    category: "artistic",
    isVisible: true,
    sortOrder: 11,
  },
  kawaii: {
    name: "Kawaii",
    promptText: "kawaii style, super cute, big eyes, small mouths, pastel colors, round shapes",
    category: "artistic",
    isVisible: true,
    sortOrder: 12,
  },
  crayon_drawing: {
    name: "Crayon Drawing",
    promptText: "crayon drawing, colorful scribbles, hand-drawn, rough texture, childlike creativity",
    category: "artistic",
    isVisible: true,
    sortOrder: 13,
  },
  doodle_art: {
    name: "Doodle Art",
    promptText: "doodle art, playful sketches, random shapes, cheerful, spontaneous drawings",
    category: "artistic",
    isVisible: true,
    sortOrder: 14,
  },
  superhero_comic: {
    name: "Superhero Comic",
    promptText: "superhero comic style, dynamic action poses, bold lines, vibrant colors, comic book feel",
    category: "artistic",
    isVisible: true,
    sortOrder: 15,
  },
  "3d_cartoon": {
    name: "3D Cartoon",
    promptText: "3D cartoon style, soft shading, round features, colorful, playful, Pixar-inspired",
    category: "design",
    isVisible: true,
    sortOrder: 16,
  },
  "3d_isometric": {
    name: "3D Isometric",
    promptText: "3D isometric view, clean lines, geometric perspective, detailed miniatures",
    category: "design",
    isVisible: true,
    sortOrder: 17,
  },
};

export async function ensureDefaultAiStyles(adminId: string = "system") {
  try {
    console.log("Initializing default AI styles...");
    let createdCount = 0;
    let skippedCount = 0;

    for (const [key, styleData] of Object.entries(DEFAULT_AI_STYLES)) {
      // Check if style already exists by name
      const existingStyles = await storage.getAiStyles();
      const existing = existingStyles.find(s => s.name === styleData.name);

      if (!existing) {
        await storage.createAiStyle({
          ...styleData,
          updatedBy: adminId,
        });
        createdCount++;
        console.log(`  ✓ Created default AI style: ${styleData.name}`);
      } else {
        skippedCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`✓ Initialized ${createdCount} default AI styles`);
    }
    if (skippedCount > 0) {
      console.log(`  (Skipped ${skippedCount} existing styles)`);
    }

    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error("Error initializing default AI styles:", error);
    throw error;
  }
}
