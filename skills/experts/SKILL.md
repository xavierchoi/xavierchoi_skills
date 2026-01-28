---
name: experts
description: This skill should be used when the user wants authoritative domain expertise applied to their task - seeking guidance from renowned practitioners, specialists, or thought leaders rather than a generic response.
version: 0.3.0
---

# Expert-Enhanced Prompt System

Apply expert perspectives to elevate work quality.

## Output Principle

**Execute silently, prove through results.**

- Do NOT output analysis, reasoning, or framework explanations
- After user selects expert, execute immediately
- Demonstrate expertise through deliverables, not explanations

## Workflow

```
Analyze (silent) → Present experts → User selects → Execute
```

### 1. Analyze Request (Silent)

- Identify domain, intent, complexity
- Do NOT output analysis to user

### 2. Select Expert (User Choice Required)

Present 2-3 experts using AskUserQuestion:
- header: "Expert"
- options: name as label, methodology as description (one line each)

User selects, then proceed to execution.

### 3. Execute

Execute immediately using selected expert's methodology. No framework explanations or technique listings.

## Expert Selection Criteria

- Proven methodology in the domain
- Directly relevant expertise
- Practically applicable

## Core Principles

- Preserve user's original goal
- Do not expand scope
- Result quality > process explanation
