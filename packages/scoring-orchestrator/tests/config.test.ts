import { jest } from "@jest/globals";
import { ConfigManager, DEFAULT_CONFIG, DEFAULT_WEIGHTS } from "../src/config.js";

describe("ConfigManager", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should use default config when no initial config provided", () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();

      expect(config.weights).toEqual(DEFAULT_WEIGHTS);
      expect(config.sentimentServiceUrl).toBe(DEFAULT_CONFIG.sentimentServiceUrl);
      expect(config.ragSettings).toEqual(DEFAULT_CONFIG.ragSettings);
    });

    it("should merge initial config with defaults", () => {
      const manager = new ConfigManager({
        weights: { sentiment: 0.8, value: 0.2, entities: 0.0 },
        sentimentServiceUrl: "http://custom:9000",
      });

      const config = manager.getConfig();

      expect(config.weights.sentiment).toBe(0.8);
      expect(config.weights.value).toBe(0.2);
      expect(config.weights.entities).toBe(0.0);
      expect(config.sentimentServiceUrl).toBe("http://custom:9000");
      expect(config.ragSettings).toEqual(DEFAULT_CONFIG.ragSettings); // Should keep defaults
    });

    it("should validate config on construction", () => {
      expect(() => {
        new ConfigManager({
          weights: { sentiment: -0.1, value: 0.5, entities: 0.1 },
        });
      }).toThrow("All weights must be non-negative");
    });
  });

  describe("updateConfig", () => {
    let manager: ConfigManager;

    beforeEach(() => {
      manager = new ConfigManager();
    });

    it("should update weights correctly", () => {
      const newWeights = { sentiment: 0.6, value: 0.3, entities: 0.1 };
      manager.updateConfig({ weights: newWeights });

      const config = manager.getConfig();
      expect(config.weights).toEqual(newWeights);
    });

    it("should partially update weights", () => {
      manager.updateConfig({ weights: { sentiment: 0.8 } });

      const config = manager.getConfig();
      expect(config.weights.sentiment).toBe(0.8);
      expect(config.weights.value).toBe(DEFAULT_WEIGHTS.value);
      expect(config.weights.entities).toBe(DEFAULT_WEIGHTS.entities);
    });

    it("should update service URL", () => {
      manager.updateConfig({ sentimentServiceUrl: "http://new-service:8080" });

      const config = manager.getConfig();
      expect(config.sentimentServiceUrl).toBe("http://new-service:8080");
    });

    it("should update RAG settings", () => {
      manager.updateConfig({
        ragSettings: { temperature: 0.7, max_tokens: 2048 },
      });

      const config = manager.getConfig();
      expect(config.ragSettings?.temperature).toBe(0.7);
      expect(config.ragSettings?.max_tokens).toBe(2048);
    });

    it("should validate updated config", () => {
      expect(() => {
        manager.updateConfig({
          weights: { sentiment: -0.1, value: 0.5, entities: 0.1 },
        });
      }).toThrow("All weights must be non-negative");
    });
  });

  describe("updateWeights", () => {
    let manager: ConfigManager;

    beforeEach(() => {
      manager = new ConfigManager();
    });

    it("should update specific weights", () => {
      manager.updateWeights({ sentiment: 0.7, value: 0.3 });

      const config = manager.getConfig();
      expect(config.weights.sentiment).toBe(0.7);
      expect(config.weights.value).toBe(0.3);
      expect(config.weights.entities).toBe(DEFAULT_WEIGHTS.entities);
    });

    it("should validate weights", () => {
      expect(() => {
        manager.updateWeights({ sentiment: -0.5 });
      }).toThrow("All weights must be non-negative");
    });
  });

  describe("validation", () => {
    it("should reject negative weights", () => {
      expect(() => {
        new ConfigManager({
          weights: { sentiment: 0.5, value: -0.1, entities: 0.1 },
        });
      }).toThrow("All weights must be non-negative");
    });

    it("should reject all-zero weights", () => {
      expect(() => {
        new ConfigManager({
          weights: { sentiment: 0, value: 0, entities: 0 },
        });
      }).toThrow("At least one weight must be greater than 0");
    });

    it("should warn about weights not summing to 1.0", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      new ConfigManager({
        weights: { sentiment: 0.8, value: 0.8, entities: 0.8 }, // Sum = 2.4
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Scoring weights sum to 2.400")
      );
    });

    it("should reject invalid URLs", () => {
      expect(() => {
        new ConfigManager({
          sentimentServiceUrl: "not-a-url",
        });
      }).toThrow("Invalid sentiment service URL: not-a-url");
    });
  });

  describe("fromEnvironment", () => {
    it("should load config from environment variables", () => {
      process.env.SCORING_WEIGHT_SENTIMENT = "0.6";
      process.env.SCORING_WEIGHT_RAG = "0.3";
      process.env.SCORING_WEIGHT_ENTITIES = "0.1";
      process.env.SENTIMENT_SERVICE_URL = "http://env-service:8080";
      process.env.RAG_TEMPERATURE = "0.7";
      process.env.RAG_MAX_TOKENS = "2048";

      const manager = ConfigManager.fromEnvironment();
      const config = manager.getConfig();

      expect(config.weights.sentiment).toBe(0.6);
        expect(config.weights.value).toBe(0.3);
      expect(config.weights.entities).toBe(0.1);
      expect(config.sentimentServiceUrl).toBe("http://env-service:8080");
      expect(config.ragSettings?.temperature).toBe(0.7);
      expect(config.ragSettings?.max_tokens).toBe(2048);
    });

    it("should use defaults when environment variables are not set", () => {
      const manager = ConfigManager.fromEnvironment();
      const config = manager.getConfig();

      expect(config.weights).toEqual(DEFAULT_WEIGHTS);
      expect(config.sentimentServiceUrl).toBe(DEFAULT_CONFIG.sentimentServiceUrl);
    });

    it("should handle partial environment configuration", () => {
      process.env.SCORING_WEIGHT_SENTIMENT = "0.8";
      process.env.SENTIMENT_SERVICE_URL = "http://partial:8080";

      const manager = ConfigManager.fromEnvironment();
      const config = manager.getConfig();

      expect(config.weights.sentiment).toBe(0.8);
      expect(config.weights.value).toBe(DEFAULT_WEIGHTS.value);
      expect(config.weights.entities).toBe(DEFAULT_WEIGHTS.entities);
      expect(config.sentimentServiceUrl).toBe("http://partial:8080");
    });
  });

  describe("getConfig", () => {
    it("should return a copy of the config", () => {
      const manager = new ConfigManager();
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects

      // Modifying returned config should not affect internal config
      config1.weights.sentiment = 0.99;
      const config3 = manager.getConfig();
      expect(config3.weights.sentiment).toBe(DEFAULT_WEIGHTS.sentiment);
    });
  });
});
