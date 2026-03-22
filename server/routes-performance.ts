import { Express } from "express";
import { storage as dbStorage } from "./storage";
import { isAuthenticated } from "./auth";

/**
 * Performance-optimized batch endpoints to reduce API calls
 */
export function registerPerformanceRoutes(app: Express) {
  
  // Batch endpoint to get user dashboard data in a single request
  app.get("/api/batch/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Fetch all dashboard data in parallel
      const [credits, images, favorites] = await Promise.all([
        dbStorage.getUserCredits(userId),
        dbStorage.getUserImages(userId),
        dbStorage.getUserFavorites(userId)
      ]);
      
      // Cache for 1 minute since user data changes frequently
      res.set('Cache-Control', 'private, max-age=60, s-maxage=60');
      
      res.json({
        credits,
        images: images || [],
        favorites: favorites || [],
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Batch endpoint for public gallery with optimized queries
  app.get("/api/batch/public-gallery", async (req, res) => {
    try {
      const [publicImages, heroSlides] = await Promise.all([
        dbStorage.getPublicImages(),
        dbStorage.getHeroSlides()
      ]);
      
      // Cache public gallery data for 5 minutes
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      
      res.json({
        images: publicImages || [],
        heroSlides: heroSlides || [],
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error fetching public gallery data:", error);
      res.status(500).json({ message: "Failed to fetch gallery data" });
    }
  });

  // Optimized model and styles data endpoint
  app.get("/api/batch/generation-data", async (req, res) => {
    try {
      // These are static/rarely changing data, fetch in parallel
      const [aiStyles] = await Promise.all([
        dbStorage.getVisibleAiStyles()
      ]);
      
      // Cache generation data for 15 minutes
      res.set('Cache-Control', 'public, max-age=900, s-maxage=900');
      
      res.json({
        aiStyles: aiStyles || [],
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error fetching generation data:", error);
      res.status(500).json({ message: "Failed to fetch generation data" });
    }
  });
}