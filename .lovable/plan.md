

## Plan: Stop and restart Alarmas RAG from scratch

### Step 1: Cancel the current build
Update the Alarmas RAG project (`8dd7011c-90e8-4756-a4e8-566223b226fa`) status to `cancelled` in the database to stop further batch processing.

### Step 2: Delete the RAG via the existing `deleteRag` action
Call the `delete` action on the edge function to cascade-delete all sources, chunks, jobs, research runs, and knowledge graph data for this RAG.

### Step 3: User creates a new RAG
After deletion, the user clicks "Nuevo RAG" in the UI and enters the Alarmas domain description again to start a clean build from batch 1.

### Technical detail
The delete action already performs a full cascade cleanup across 13 tables. After deletion, the user simply creates a new project through the UI. No code changes needed.

