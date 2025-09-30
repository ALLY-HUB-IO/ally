# Infrastructure Configuration

This directory contains configuration files for the Ally platform infrastructure.

## Files

### `supported.json`
Centralized configuration for supported blockchains and social platforms.

**Location**: `infra/supported.json`

This file defines all supported blockchains and platforms across the Ally ecosystem. It's used by:
- Backend services for validation and data access
- Frontend applications for dropdown options
- Admin panels for dynamic form generation
- API routes for request validation

#### Structure

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

#### Blockchain Fields
- `id`: Unique identifier (used in API calls and database)
- `name`: Human-readable display name
- `chainId`: Blockchain network ID
- `nativeSymbol`: Native token symbol (e.g., ETH, TFUEL)
- `rpcUrl`: RPC endpoint URL for blockchain interaction
- `isTestnet`: Boolean indicating if this is a testnet

#### Platform Fields
- `id`: Unique identifier (used in API calls and database)
- `name`: Human-readable display name
- `description`: Brief description of the platform

### `docker-compose.yml`
Docker Compose configuration for local development environment.

### `example.env`
Example environment variables file. Copy to `.env` and customize for your environment.

### `prompts.json`
AI prompt templates for the platform.

### `custom_entities.jsonl`
Custom entity definitions for AI processing.

## Adding New Blockchains

1. Edit `infra/supported.json`
2. Add a new blockchain object with all required fields:

```json
{
  "id": "new-blockchain",
  "name": "New Blockchain",
  "chainId": "12345",
  "nativeSymbol": "NEW",
  "rpcUrl": "https://rpc.newblockchain.com",
  "isTestnet": false
}
```

3. Restart the services to pick up the new configuration
4. No code changes are required - the configuration is automatically loaded

## Adding New Platforms

1. Edit `infra/supported.json`
2. Add a new platform object with all required fields:

```json
{
  "id": "new-platform",
  "name": "New Platform",
  "description": "Integration with New Platform"
}
```

3. Restart the services to pick up the new configuration
4. No code changes are required - the configuration is automatically loaded

## Validation

The configuration file is automatically validated on startup using Joi schemas. The system will:

- ✅ Validate JSON syntax
- ✅ Check for required fields
- ✅ Validate URL formats for RPC endpoints
- ✅ Ensure unique IDs across blockchains and platforms
- ❌ Fail to start if validation fails

## Error Handling

If the configuration file is missing or malformed:

1. **Backend services** will fail to start with a clear error message
2. **Frontend applications** will show an error and request a page refresh
3. **API endpoints** will return appropriate error responses

## Development

### Local Development
- Configuration is loaded from `infra/supported.json`
- Changes require service restart to take effect
- Use `npm run dev` for automatic restart on file changes

### Production
- Ensure `infra/supported.json` is included in deployment
- Configuration is validated on service startup
- Services will fail fast if configuration is invalid

## Integration

The configuration is used by:

- **@ally/config package**: Core configuration service
- **Admin Service**: Campaign validation and API endpoints
- **Shade Agent**: RPC URL resolution
- **Admin Dashboard**: Dynamic form options
- **All Services**: Platform and blockchain validation

## Best Practices

1. **Always validate locally** before deploying configuration changes
2. **Use descriptive names** for blockchain and platform IDs
3. **Keep RPC URLs up-to-date** and test connectivity
4. **Document new additions** in team communications
5. **Test thoroughly** after adding new blockchains/platforms

## Troubleshooting

### Configuration Not Loading
- Check file path: `infra/supported.json`
- Validate JSON syntax using a JSON validator
- Check file permissions and accessibility

### Validation Errors
- Ensure all required fields are present
- Check URL formats for RPC endpoints
- Verify unique IDs across all entries

### Service Startup Failures
- Check logs for specific validation errors
- Ensure configuration file exists and is readable
- Verify all required dependencies are installed
