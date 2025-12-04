# Memoria Benchmark Results

**Date:** 2025-12-04T07:35:18.400Z
**Node:** v25.2.1
**Platform:** darwin arm64

## Individual Engine Performance

| Engine | Avg (ms) | Median (ms) | P95 (ms) | Output Tokens |
|--------|----------|-------------|----------|---------------|
| createAnalysisContext | 7.11 | 7.07 | 7.47 | ~0 |
| getCoupledFiles (cold) | 49.73 | 48.75 | 54.47 | ~964 |
| getCoupledFiles (cached) | 0.02 | 0.01 | 0.06 | ~964 |
| getVolatility (cold) | 11.72 | 11.43 | 13.3 | ~204 |
| checkDrift | 0.09 | 0.08 | 0.11 | ~1 |
| getImporters (cold) | 8.78 | 8.83 | 9.34 | ~1 |
| searchHistory | 8.22 | 7.42 | 11.87 | ~626 |
| getSiblingGuidance | 0.07 | 0.07 | 0.09 | ~1 |
| Full Analysis (formatOutput) | 114.12 | 120.14 | 134.88 | ~516 |

## Summary

- **Full analysis time:** 114.12ms average
- **Tokens per analysis:** ~516 tokens
- **Cache speedup:** 2486.5x faster on cache hit

## README Badge Data

```
Analysis Speed: <200ms
Token Usage: ~600 tokens/analysis
Cache Speedup: 2486.5x
```

## Raw JSON

```json
{
  "timestamp": "2025-12-04T07:35:18.400Z",
  "nodeVersion": "v25.2.1",
  "platform": "darwin arm64",
  "results": [
    {
      "name": "createAnalysisContext",
      "runs": 10,
      "avgMs": 7.11,
      "minMs": 6.65,
      "maxMs": 7.47,
      "medianMs": 7.07,
      "p95Ms": 7.47,
      "outputChars": 0,
      "estimatedTokens": 0
    },
    {
      "name": "getCoupledFiles (cold)",
      "runs": 5,
      "avgMs": 49.73,
      "minMs": 45.33,
      "maxMs": 54.47,
      "medianMs": 48.75,
      "p95Ms": 54.47,
      "outputChars": 3854,
      "estimatedTokens": 964
    },
    {
      "name": "getCoupledFiles (cached)",
      "runs": 10,
      "avgMs": 0.02,
      "minMs": 0.01,
      "maxMs": 0.06,
      "medianMs": 0.01,
      "p95Ms": 0.06,
      "outputChars": 3854,
      "estimatedTokens": 964
    },
    {
      "name": "getVolatility (cold)",
      "runs": 5,
      "avgMs": 11.72,
      "minMs": 11.05,
      "maxMs": 13.3,
      "medianMs": 11.43,
      "p95Ms": 13.3,
      "outputChars": 815,
      "estimatedTokens": 204
    },
    {
      "name": "checkDrift",
      "runs": 10,
      "avgMs": 0.09,
      "minMs": 0.07,
      "maxMs": 0.11,
      "medianMs": 0.08,
      "p95Ms": 0.11,
      "outputChars": 2,
      "estimatedTokens": 1
    },
    {
      "name": "getImporters (cold)",
      "runs": 5,
      "avgMs": 8.78,
      "minMs": 8.06,
      "maxMs": 9.34,
      "medianMs": 8.83,
      "p95Ms": 9.34,
      "outputChars": 2,
      "estimatedTokens": 1
    },
    {
      "name": "searchHistory",
      "runs": 5,
      "avgMs": 8.22,
      "minMs": 6.85,
      "maxMs": 11.87,
      "medianMs": 7.42,
      "p95Ms": 11.87,
      "outputChars": 2503,
      "estimatedTokens": 626
    },
    {
      "name": "getSiblingGuidance",
      "runs": 5,
      "avgMs": 0.07,
      "minMs": 0.07,
      "maxMs": 0.09,
      "medianMs": 0.07,
      "p95Ms": 0.09,
      "outputChars": 4,
      "estimatedTokens": 1
    },
    {
      "name": "Full Analysis (formatOutput)",
      "runs": 5,
      "avgMs": 114.12,
      "minMs": 92.94,
      "maxMs": 134.88,
      "medianMs": 120.14,
      "p95Ms": 134.88,
      "outputChars": 2061,
      "estimatedTokens": 516
    }
  ],
  "summary": {
    "totalAnalysisTimeMs": 114.12,
    "estimatedTokensPerAnalysis": 516,
    "cacheHitSpeedupFactor": 2486.5
  }
}
```
