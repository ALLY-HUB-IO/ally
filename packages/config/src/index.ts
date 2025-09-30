import * as fs from 'fs';
import * as path from 'path';
import Joi from 'joi';

export interface Blockchain {
  id: string;
  name: string;
  chainId: string;
  nativeSymbol: string;
  rpcUrl: string;
  isTestnet: boolean;
}

export interface Platform {
  id: string;
  name: string;
  description: string;
}

export interface SupportedConfig {
  blockchains: Blockchain[];
  platforms: Platform[];
}

// Validation schemas
const blockchainSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  chainId: Joi.string().required(),
  nativeSymbol: Joi.string().required(),
  rpcUrl: Joi.string().uri().required(),
  isTestnet: Joi.boolean().required()
});

const platformSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required()
});

const configSchema = Joi.object({
  blockchains: Joi.array().items(blockchainSchema).min(1).required(),
  platforms: Joi.array().items(platformSchema).min(1).required()
});

class ConfigService {
  private config: SupportedConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'infra', 'supported.json');
    if (configPath) {
      this.configPath = configPath;
    } else {
      // Try multiple possible locations for the config file
      const possiblePaths = [
        path.join(process.cwd(), 'infra', 'supported.json'),
        path.join(process.cwd(), '..', 'infra', 'supported.json'),
        path.join(process.cwd(), '..', '..', 'infra', 'supported.json'),
        '/app/infra/supported.json'
      ];
      
      // Find the first existing path
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          this.configPath = possiblePath;
          break;
        }
      }
    }
  }

  /**
   * Load and validate the configuration file
   */
  loadConfig(): SupportedConfig {
    if (this.config) {
      return this.config;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found at: ${this.configPath}`);
      }

      // Read and parse the file
      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      const rawConfig = JSON.parse(fileContent);

      // Validate the configuration
      const { error, value } = configSchema.validate(rawConfig);
      if (error) {
        throw new Error(`Configuration validation failed: ${error.details[0].message}`);
      }

      this.config = value;
      console.log(`✅ Configuration loaded successfully from ${this.configPath}`);
      console.log(`📊 Loaded ${value.blockchains.length} blockchains and ${value.platforms.length} platforms`);
      
      return value;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Get all supported blockchain IDs
   */
  getSupportedChainIds(): string[] {
    const config = this.loadConfig();
    return config.blockchains.map(b => b.id);
  }

  /**
   * Get all supported platform IDs
   */
  getSupportedPlatformIds(): string[] {
    const config = this.loadConfig();
    return config.platforms.map(p => p.id);
  }

  /**
   * Get blockchain by ID
   */
  getBlockchain(id: string): Blockchain | undefined {
    const config = this.loadConfig();
    return config.blockchains.find(b => b.id === id);
  }

  /**
   * Get platform by ID
   */
  getPlatform(id: string): Platform | undefined {
    const config = this.loadConfig();
    return config.platforms.find(p => p.id === id);
  }

  /**
   * Get all blockchains
   */
  getBlockchains(): Blockchain[] {
    const config = this.loadConfig();
    return config.blockchains;
  }

  /**
   * Get all platforms
   */
  getPlatforms(): Platform[] {
    const config = this.loadConfig();
    return config.platforms;
  }

  /**
   * Get blockchains formatted for frontend dropdowns
   */
  getBlockchainsForFrontend(): Array<{ value: string; label: string }> {
    const config = this.loadConfig();
    return config.blockchains.map(b => ({
      value: b.id,
      label: b.name
    }));
  }

  /**
   * Get platforms formatted for frontend dropdowns
   */
  getPlatformsForFrontend(): Array<{ value: string; label: string }> {
    const config = this.loadConfig();
    return config.platforms.map(p => ({
      value: p.id,
      label: p.name
    }));
  }

  /**
   * Validate if a chain ID is supported
   */
  isChainSupported(chainId: string): boolean {
    return this.getSupportedChainIds().includes(chainId);
  }

  /**
   * Validate if a platform ID is supported
   */
  isPlatformSupported(platformId: string): boolean {
    return this.getSupportedPlatformIds().includes(platformId);
  }

  /**
   * Get RPC URL for a blockchain
   */
  getRpcUrl(chainId: string): string | undefined {
    const blockchain = this.getBlockchain(chainId);
    return blockchain?.rpcUrl;
  }

  /**
   * Reload configuration (useful for development)
   */
  reloadConfig(): SupportedConfig {
    this.config = null;
    return this.loadConfig();
  }
}

// Create singleton instance
export const configService = new ConfigService();

// Export types and service
export { ConfigService };
export default configService;
