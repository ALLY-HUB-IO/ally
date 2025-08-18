# Ally Scoring Orchestrator

A TypeScript SDK that combines multiple AI scoring services into a unified scoring system. This orchestrator integrates sentiment analysis and value scoring (via EdgeCloud) to provide comprehensive content evaluation.

## Features

- **Multi-Service Integration**: Combines EdgeCloud value scoring and Sentiment Service
- **Configurable Weights**: Easily adjust the importance of different scoring components
- **TypeScript Support**: Full type safety and IntelliSense support
- **Parallel Processing**: Executes API calls concurrently for optimal performance
- **Comprehensive Scoring**: Returns detailed breakdowns and metadata
- **Environment Configuration**: Load configuration from environment variables
- **Extensive Testing**: Unit tests with mock APIs included

## Installation

```bash
npm install @ally/scoring-orchestrator
```

## Quick Start

```typescript
import { createScoreOrchestrator } from '@ally/scoring-orchestrator';

// Create orchestrator with default configuration
const orchestrator = createScoreOrchestrator();

// Score a message
const result = await orchestrator.score({
  text: "Theta blockchain technology is revolutionary!",
  projectId: "my-project-id"
});

console.log(`Final Score: ${result.finalScore}`);
console.log(`Sentiment: ${result.breakdown.sentiment.label} (${result.breakdown.sentiment.score})`);
console.log(`Value Score: ${result.breakdown.value.score}`);
```

## Configuration

### Basic Configuration

```typescript
import { createScoreOrchestrator } from '@ally/scoring-orchestrator';

const orchestrator = createScoreOrchestrator({
  weights: {
    sentiment: 0.4,  // 40% weight for sentiment analysis
    value: 0.5,      // 50% weight for value scoring
  },
  sentimentServiceUrl: "http://localhost:8080",
  ragSettings: {
    temperature: 0.3,
    max_tokens: 1024,
  }
});
```

### Environment Variables

The orchestrator can load configuration from environment variables:

```bash
# Scoring weights
SCORING_WEIGHT_SENTIMENT=0.4
SCORING_WEIGHT_VALUE=0.5

# Service URLs
SENTIMENT_SERVICE_URL=http://localhost:8080

# RAG settings
RAG_TEMPERATURE=0.3
RAG_MAX_TOKENS=1024
```

```typescript
import { ConfigManager } from '@ally/scoring-orchestrator';

// Load from environment
const orchestrator = createScoreOrchestrator();
// or
const config = ConfigManager.fromEnvironment();
const orchestrator = new AllyScoreOrchestrator(config.getConfig());
```

### Dynamic Configuration Updates

```typescript
// Update weights at runtime
orchestrator.updateConfig({
  weights: {
    sentiment: 0.6,
    value: 0.4
  }
});

// Update service URL
orchestrator.updateConfig({
  sentimentServiceUrl: "http://new-service:8080"
});
```

## API Reference

### ScoringRequest

```typescript
interface ScoringRequest {
  text: string;           // Text to analyze
  projectId: string;      // EdgeCloud project ID
  context?: {             // Optional context
    userId?: string;
    messageId?: string;
    timestamp?: string;
  };
}
```

### CombinedScoringResult

```typescript
interface CombinedScoringResult {
  finalScore: number;     // Weighted average of normalized scores [0,1]
  breakdown: {
    sentiment: {
      score: number;              // Normalized sentiment score [0,1]
      label: "negative" | "neutral" | "positive";
      weight: number;             // Applied weight
      weightedScore: number;      // score * weight
    };
    value: {
      score: number;              // Normalized value score [0,1]
      weight: number;
      weightedScore: number;
    };
  };
  metadata: {
    processingTimeMs: number;
    timestamp: string;
    models: {
      sentiment: string;          // Sentiment model used
      value: string;               // Value model used (RAG model)
    };
  };
  rawResponses: {
    sentiment: SentimentResponse; // Raw sentiment API response
    value: RagChatResponse;       // Raw value (EdgeCloud) API response
  };
}
```

## Scoring Algorithm

### Sentiment Scoring
- Normalizes sentiment scores from `[-1, 1]` to `[0, 1]` range
- Maps sentiment labels: negative/neutral/positive
- Uses confidence probabilities for accuracy

### Value Scoring
- Uses an EdgeCloud prompt to extract a numeric value score in [-1, 1], which is normalized to [0, 1]

### Final Score Calculation
```
finalScore = (
  (sentimentScore × sentimentWeight) +
  (valueScore × valueWeight)
) / (sentimentWeight + valueWeight)
```

## Error Handling

The orchestrator handles various error scenarios:

```typescript
try {
  const result = await orchestrator.score(request);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout
  } else if (error.message.includes('Service unavailable')) {
    // Handle service downtime
  } else {
    // Handle other errors
  }
}
```

## Testing

Run the test suite:

```bash
npm test
```

The package includes comprehensive unit tests with mocked APIs:
- Orchestrator integration tests
- Sentiment client tests
- Configuration management tests
- Error handling tests

## Requirements

- **EdgeCloud Service**: Value-scoring (using RAG API) via EdgeCloud must be accessible
- **Sentiment Service**: Ally sentiment service must be running
- **Environment**: Node.js 18+ with ES modules support

## Environment Setup

1. **EdgeCloud Configuration**:
   ```bash
   TEC_RAG_BASE_URL=https://your-edgecloud-instance.com
   TEC_RAG_API_KEY=your-api-key
   ```

2. **Sentiment Service**: Should be running on configured URL (default: `http://localhost:8080`)

3. **Project ID**: Ensure you have a valid EdgeCloud project ID for RAG queries

## Example Usage Patterns

### Basic Scoring
```typescript
const result = await orchestrator.score({
  text: "I love this new blockchain technology!",
  projectId: "crypto-kb"
});

console.log(`Score: ${result.finalScore}`);
console.log(`Sentiment: ${result.breakdown.sentiment.label}`);
```

### Batch Processing
```typescript
const texts = [
  "Great project!",
  "Not sure about this...",
  "Terrible implementation"
];

const results = await Promise.all(
  texts.map(text => orchestrator.score({ text, projectId: "test" }))
);
```

### Custom Weights for Different Use Cases
```typescript
// For sentiment-heavy analysis
orchestrator.updateConfig({
  weights: { sentiment: 0.7, value: 0.3}
});

// For value-centric analysis
orchestrator.updateConfig({
  weights: { sentiment: 0.2, value: 0.7}
});
```

## License

See the main project license in the repository root.
