---
name: understand-chat
description: Ask questions about the current codebase using the knowledge graph
arguments: query
---

# /understand-chat

Answer questions about this codebase using the knowledge graph at `.understand-anything/knowledge-graph.json`.

## Instructions

1. Read the knowledge graph file at `.understand-anything/knowledge-graph.json` in the current project root
2. If the file doesn't exist, tell the user to run `/understand` first to analyze the project
3. Use the knowledge graph context to answer the user's query: "${ARGUMENTS}"
4. Reference specific files, functions, and relationships from the graph
5. If the project has layers defined, explain which layer(s) are relevant
6. Be concise but thorough -- link concepts to actual code locations
