# @ally/config

Centralized configuration service for supported blockchains and platforms in the Ally ecosystem.

## Overview

This package provides a centralized way to manage and validate supported blockchains and social platforms across all Ally services. It loads configuration from `infra/supported.json` and provides validation, type safety, and easy access to configuration data.

## Features

- ✅ Centralized configuration management
- ✅ Runtime validation using Joi schemas
- ✅ TypeScript support with full type definitions
- ✅ Singleton pattern for efficient memory usage
- ✅ Frontend-friendly data formatting
- ✅ RPC URL resolution for blockchains
- ✅ Support validation helpers

## Usage

### Basic Usage

```typescript
import { configService } from '@ally/config';

// Load configuration (validates on first access)
const config = configService.loadConfig();

// Get supported chain IDs
const chainIds = configService.getSupportedChainIds();
// ['ethereum', 'polygon', 'bsc', ...]

// Get supported platform IDs
const platformIds = configService.getSupportedPlatformIds();
// ['discord', 'twitter', 'telegram', 'reddit']

// Get blockchain details
const ethereum = configService.getBlockchain('ethereum');
// { id: 'ethereum', name: 'Ethereum', chainId: '1', ... }

// Get platform details
const discord = configService.getPlatform('discord');
// { id: 'discord', name: 'Discord', description: '...' }
```

### Frontend Integration

```typescript
// Get data formatted for dropdowns
const chainOptions = configService.getBlockchainsForFrontend();
// [{ value: 'ethereum', label: 'Ethereum' }, ...]

const platformOptions = configService.getPlatformsForFrontend();
// [{ value: 'discord', label: 'Discord' }, ...]
```

### Validation

```typescript
// Check if chain/platform is supported
const isSupported = configService.isChainSupported('ethereum'); // true
const isSupported = configService.isPlatformSupported('discord'); // true

// Get RPC URL for a blockchain
const rpcUrl = configService.getRpcUrl('ethereum');
// 'https://eth.llamarpc.com'
```

## Configuration File

The configuration is stored in `infra/supported.json`:

```json
{
  "blockchains": [
    {
      "id": "ethereum",
      "name": "Ethereum",
      "chainId": "1",
      "nativeSymbol": "ETH",
      "rpcUrl": "https://eth.llamarpc.com",
      "isTestnet": false
    }
  ],
  "platforms": [
    {
      "id": "discord",
      "name": "Discord",
      "description": "Discord server integration"
    }
  ]
}
```

## Adding New Blockchains/Platforms

1. Edit `infra/supported.json`
2. Add the new blockchain/platform with all required fields
3. The configuration will be automatically validated on next load
4. No code changes needed - the service will pick up the new entries

## Error Handling

The service provides clear error messages for:
- Missing configuration file
- Invalid JSON syntax
- Validation errors (missing required fields, invalid URLs, etc.)

## Development

```bash
# Build the package
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test
```

## Integration

This package is designed to be used across all Ally services:

- **Backend services**: Import and use for validation and data access
- **Frontend applications**: Use for dropdown options and validation
- **Admin panels**: Use for dynamic form generation
- **API routes**: Use for request validation

## Type Safety

All configuration data is fully typed with TypeScript interfaces:

```typescript
interface Blockchain {
  id: string;
  name: string;
  chainId: string;
  nativeSymbol: string;
  rpcUrl: string;
  isTestnet: boolean;
}

interface Platform {
  id: string;
  name: string;
  description: string;
}
```
