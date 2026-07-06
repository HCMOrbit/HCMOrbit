# Ask Orbit — KB Indexing Pipeline

The offline pipeline that makes the `kb_docs` collection searchable by
meaning. `POST /api/ask` (built separately) will `$vectorSearch` against
the `kb_chunks` collection produced here.

## Architecture

```
kb_docs  ──▶  chunker.py     ──▶  chunks (metadata only)
             (section-level)      │
                                  ▼
                             embedder.py (Voyage voyage-3, 1024-d)
                                  │
                                  ▼
                             kb_chunks   ──▶   Atlas Vector Search index
                             (metadata + vector)
```

**Chunking is section-level, not fixed-length.** Splits on numbered H1
headings (`^\s*\d+\.\s`) — the 15 canonical sections of an HCMOrbit
article. Long sections sub-split on H2 boundaries so a single failure
scenario in §8 is independently retrievable. Empty heading-only matches
are dropped. Articles that don't parse to exactly 15 sections are flagged
but still indexed for whatever sections did parse.

**Embeddings are Voyage `voyage-3` (1024-dim, cosine).** Configurable via
`VOYAGE_MODEL` env var. Model + dim are stored on every chunk so a future
model migration is a filtered re-index, not a wipe.

**Idempotent.** Re-indexing an article deletes its existing chunks
before writing new — running the same script twice never duplicates.

## Files

| Path | Purpose |
|---|---|
| `backend/services/kb_indexing/chunker.py` | Pure section-level chunker + edge cases |
| `backend/services/kb_indexing/embedder.py` | Voyage HTTP client with 128-batch + retry/backoff |
| `backend/services/kb_indexing/indexer.py` | Orchestrator: `reindex_article()` + `reindex_all()` |
| `backend/routes/admin_kb_index.py` | `POST /api/admin/kb/reindex/{ref}` + `-all` + `GET /index-stats` |
| `backend/scripts/reindex_all_kb.py` | One-off full-index CLI (prints JSON report) |
| `backend/tests/test_kb_chunker.py` | 10 chunker tests — no DB, no HTTP |
| `atlas-index-definition.json` | Vector Search index config to paste into Atlas UI |

## Environment

Add to backend `.env` (or Railway env):

```bash
VOYAGE_API_KEY=<from https://dash.voyageai.com/api-keys>
VOYAGE_MODEL=voyage-3           # optional; default voyage-3 (1024-dim)
```

## Running the full re-index

```bash
cd /app/backend
python -m scripts.reindex_all_kb          # published articles only
python -m scripts.reindex_all_kb --all    # include drafts too
```

Prints a JSON report to stdout with:
- `articles_indexed`, `chunks_created`, `embeddings_written`
- `malformed`: articles that didn't parse to 15 sections (with reasons)
  — these are content-quality signals worth surfacing to the docs team

## Creating the Atlas Vector Search index

1. Atlas UI → your cluster → **Search** → **Create Search Index**
2. Choose **JSON Editor**
3. Database: `<your db>` · Collection: `kb_chunks`
4. Index name: `kb_chunks_vector_index`
5. Paste the `definition` block from `atlas-index-definition.json`
6. Wait for `Status: Active` (usually <5 min for cold start)

The index name `kb_chunks_vector_index` is hard-coded in
`atlas-index-definition.json` — the retrieval side (built in the next PR)
will reference it by this name.

## Admin API

```bash
# Re-index one article (idempotent)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  $API/api/admin/kb/reindex/WD-KB-INTEG-042

# Full re-index (long-running — ~1s per article at Voyage rate limits)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  $API/api/admin/kb/reindex-all

# Health check
curl -H "Authorization: Bearer $TOKEN" $API/api/admin/kb/index-stats
```
