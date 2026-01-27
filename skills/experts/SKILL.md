---
name: experts
description: This skill should be used when the user wants authoritative domain expertise applied to their task - seeking guidance from renowned practitioners, specialists, or thought leaders rather than a generic response. Auto-select quick mode when the request is straightforward; use interactive mode when complex or user wants to choose.
version: 0.2.0
---

# Expert-Enhanced Prompt System

Transform simple requests into expert-informed prompts by suggesting domain experts and applying their methodologies.

## Mode Selection

Select mode based on context and user intent:

### Quick Mode (Default)

Auto-select the most appropriate expert and execute immediately.

**When to use:**
- Request is clear and specific
- Single obvious domain
- User tone suggests efficiency preference
- No ambiguity about desired outcome

**Flow:** Analyze → Auto-select expert → Generate enhanced prompt → Execute

### Interactive Mode

Present 2-3 expert options for user selection.

**When to use:**
- Request is vague or spans multiple domains
- User explicitly wants options (e.g., "어떤 전문가가 있어?", "show me options")
- Complex task where expert choice significantly affects outcome
- User seems exploratory or uncertain

**Flow:** Analyze → Present experts → User selects → Generate enhanced prompt → Offer to execute

## Core Workflow

### Step 1: Analyze Request

Parse the request to identify:

1. **Domain**: What field does this belong to?
2. **Intent**: What is the user trying to accomplish?
3. **Complexity**: Simple/clear vs. complex/ambiguous?
4. **Mode signal**: Quick or interactive?

### Step 2: Suggest Experts

Recommend 2-3 renowned experts from built-in knowledge.

**Default (No Web Search):**
- Use knowledge of established experts (authors, thought leaders, practitioners)
- Provides instant response without search latency

**Optional Web Search:**
- Only when user explicitly requests latest/emerging experts
- Useful for: newly emerging figures, very niche domains

**For each expert, provide:**
- Name and background (1 sentence)
- Signature methodology
- How they would approach this task

**Quick Mode:** Select the single best-fit expert automatically.

**Interactive Mode:** Use AskUserQuestion tool:
- header: "Expert"
- question: "Which expert's perspective to apply?"
- options: 2-3 experts, each with label (name) and description (methodology + approach)

### Step 3: Generate Enhanced Prompt

Create a focused enhanced prompt:

```
## [Expert]'s Approach

**Framework:** [Their methodology applied to this task]

**Key Techniques:**
- [Technique 1]
- [Technique 2]
- [Technique 3]

**Success Criteria:**
- [What expert would consider essential]
- [Quality markers]
```

### Step 4: Execute or Offer

**Quick Mode:** Execute immediately using the enhanced prompt.

**Interactive Mode:** Ask "이 프롬프트로 바로 실행할까요?" then execute if confirmed.

## Expert Selection Guidelines

Select experts who:
- Have demonstrable track records
- Offer distinct, well-documented methodologies
- Have insights applicable to user's context

Avoid:
- Generic influencers without substantive expertise
- Experts unrelated to the actual request
- Controversial figures without clear professional merit

## Preserving User Intent

The enhanced prompt must:
- Maintain the original goal
- Not add unwanted scope or complexity
- Respect stated constraints
- Be executable with available resources

## Example Flow

### Quick Mode Example
```
User: "전문가처럼 생산성 블로그 글 써줘"

[Analyze: clear request, single domain (productivity/writing), no ambiguity → Quick Mode]
[Auto-select: Cal Newport - Deep Work methodology fits productivity writing]
[Generate enhanced prompt with Newport's framework]
[Execute immediately]
```

### Interactive Mode Example
```
User: "전문가 관점으로 우리 스타트업 전략 좀 봐줘"

[Analyze: broad request, multiple possible angles → Interactive Mode]
[AskUserQuestion: header="Expert", options=Porter/Ries/Thiel with descriptions]
[User selects: Eric Ries]
[Generate enhanced prompt with Lean Startup framework]
[Offer to execute → User confirms → Execute]
```
