# Memoria Benchmark Results

**Date:** 2025-12-04T06:10:59.107Z
**Node:** v25.2.1
**Platform:** darwin arm64

## Individual Engine Performance

| Engine | Avg (ms) | Median (ms) | P95 (ms) | Output Tokens |
|--------|----------|-------------|----------|---------------|
| createAnalysisContext | 7.86 | 7.64 | 9.18 | ~0 |
| getCoupledFiles (cold) | 42.35 | 42.12 | 45.02 | ~1050 |
| getCoupledFiles (cached) | 0.02 | 0.02 | 0.02 | ~1050 |
| getVolatility (cold) | 10.27 | 10.34 | 10.99 | ~204 |
| checkDrift | 0.09 | 0.08 | 0.13 | ~1 |
| getImporters (cold) | 8.31 | 8.12 | 9.31 | ~1 |
| searchHistory | 7.19 | 6.91 | 8.55 | ~374 |
| getSiblingGuidance | 0.05 | 0.04 | 0.08 | ~1 |
| Full Analysis (formatOutput) | 97.8 | 93.35 | 118.8 | ~567 |

## Summary

- **Full analysis time:** 97.8ms average
- **Tokens per analysis:** ~567 tokens
- **Cache speedup:** 2117.5x faster on cache hit

## README Badge Data

```
Analysis Speed: <100ms
Token Usage: ~600 tokens/analysis
Cache Speedup: 2117.5x
```

## Raw JSON

```json
{
  "timestamp": "2025-12-04T06:10:59.107Z",
  "nodeVersion": "v25.2.1",
  "platform": "darwin arm64",
  "results": [
    {
      "name": "createAnalysisContext",
      "runs": 10,
      "avgMs": 7.86,
      "minMs": 6.97,
      "maxMs": 9.18,
      "medianMs": 7.64,
      "p95Ms": 9.18,
      "outputChars": 0,
      "estimatedTokens": 0
    },
    {
      "name": "getCoupledFiles (cold)",
      "runs": 5,
      "avgMs": 42.35,
      "minMs": 39.73,
      "maxMs": 45.02,
      "medianMs": 42.12,
      "p95Ms": 45.02,
      "outputChars": 4198,
      "estimatedTokens": 1050
    },
    {
      "name": "getCoupledFiles (cached)",
      "runs": 10,
      "avgMs": 0.02,
      "minMs": 0.01,
      "maxMs": 0.02,
      "medianMs": 0.02,
      "p95Ms": 0.02,
      "outputChars": 4198,
      "estimatedTokens": 1050
    },
    {
      "name": "getVolatility (cold)",
      "runs": 5,
      "avgMs": 10.27,
      "minMs": 9.55,
      "maxMs": 10.99,
      "medianMs": 10.34,
      "p95Ms": 10.99,
      "outputChars": 815,
      "estimatedTokens": 204
    },
    {
      "name": "checkDrift",
      "runs": 10,
      "avgMs": 0.09,
      "minMs": 0.05,
      "maxMs": 0.13,
      "medianMs": 0.08,
      "p95Ms": 0.13,
      "outputChars": 2,
      "estimatedTokens": 1
    },
    {
      "name": "getImporters (cold)",
      "runs": 5,
      "avgMs": 8.31,
      "minMs": 7.86,
      "maxMs": 9.31,
      "medianMs": 8.12,
      "p95Ms": 9.31,
      "outputChars": 2,
      "estimatedTokens": 1
    },
    {
      "name": "searchHistory",
      "runs": 5,
      "avgMs": 7.19,
      "minMs": 6.37,
      "maxMs": 8.55,
      "medianMs": 6.91,
      "p95Ms": 8.55,
      "outputChars": 1495,
      "estimatedTokens": 374
    },
    {
      "name": "getSiblingGuidance",
      "runs": 5,
      "avgMs": 0.05,
      "minMs": 0.04,
      "maxMs": 0.08,
      "medianMs": 0.04,
      "p95Ms": 0.08,
      "outputChars": 4,
      "estimatedTokens": 1
    },
    {
      "name": "Full Analysis (formatOutput)",
      "runs": 5,
      "avgMs": 97.8,
      "minMs": 83.92,
      "maxMs": 118.8,
      "medianMs": 93.35,
      "p95Ms": 118.8,
      "outputChars": 2265,
      "estimatedTokens": 567
    }
  ],
  "summary": {
    "totalAnalysisTimeMs": 97.8,
    "estimatedTokensPerAnalysis": 567,
    "cacheHitSpeedupFactor": 2117.5
  }
}
```
