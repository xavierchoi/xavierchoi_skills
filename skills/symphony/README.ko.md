# Symphony Skill

플랜 파일에서 병렬 페이즈 실행을 조율하는 Claude Code 스킬입니다. Symphony는 마크다운 플랜에서 `symphony-phases` 블록을 파싱하고, 의존성 DAG를 구축하며, Task 도구를 사용하여 페이즈를 동시에 실행합니다.

## 목차

- [개요](#개요)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [작동 방식](#작동-방식)
- [자동 재시도](#자동-재시도)
- [상태 표시줄 시각화](#상태-표시줄-시각화)
- [트리거 키워드](#트리거-키워드)
- [플랜 파일 형식](#플랜-파일-형식)
- [페이즈 스키마](#페이즈-스키마)
- [CLI 스크립트](#cli-스크립트)
- [예제 워크플로우](#예제-워크플로우)
- [상태 관리](#상태-관리)

---

## 개요

Symphony는 복잡한 다단계 개발 플랜을 효율적으로 실행하는 문제를 해결합니다. 작업을 순차적으로 실행하는 대신 Symphony는 다음과 같이 동작합니다:

- **구조화된 플랜 파싱**: `symphony-phases` 코드 블록이 포함된 마크다운 파일에서 플랜을 파싱합니다
- **의존성 해결**: Kahn 알고리즘을 사용한 방향성 비순환 그래프(DAG)로 의존성을 해결합니다
- **병렬 페이즈 실행**: 의존성이 허용하는 경우 Claude Code의 Task 도구를 사용하여 페이즈를 병렬로 실행합니다
- **아티팩트 전파**: 페이즈 간에 아티팩트를 전파하여 의존 페이즈가 선행 작업의 출력을 받을 수 있도록 합니다
- **실행 상태 추적**: 모니터링 및 복구를 위해 JSON 파일에 실행 상태를 추적합니다

이를 통해 복잡한 구현 플랜을 한 번 작성하면 Symphony가 자동으로 실행을 조율합니다.

---

## 설치

Symphony는 **프로젝트 로컬 스킬** 또는 **개인 스킬**로 설치할 수 있습니다. 자세한 내용은 [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)을 참조하세요.

### 사전 요구사항

- [Claude Code CLI](https://claude.com/claude-code) 설치 및 설정 완료
- [Bun](https://bun.sh) 런타임 (CLI 스크립트 실행용)

### 옵션 1: 프로젝트 로컬 설치 (권장)

`symphony` 폴더를 프로젝트의 `.claude/skills/` 디렉토리에 복사합니다:

```bash
# 프로젝트 루트에서
mkdir -p .claude/skills
cp -r path/to/symphony .claude/skills/
```

이 방식은 Symphony를 현재 프로젝트 내에서만 사용할 수 있게 하며 버전 관리가 가능합니다.

### 옵션 2: 개인 설치

전역 접근을 위해 개인 스킬 디렉토리에 복사합니다:

```bash
# 모든 프로젝트에서 사용 가능
mkdir -p ~/.claude/skills
cp -r path/to/symphony ~/.claude/skills/
```

### 옵션 3: 저장소에서 클론

```bash
# 프로젝트 로컬
git clone https://github.com/anthropics/symphony .claude/skills/symphony

# 또는 개인
git clone https://github.com/anthropics/symphony ~/.claude/skills/symphony
```

### 설치 확인

```bash
# SKILL.md 존재 확인
ls .claude/skills/symphony/SKILL.md   # 프로젝트 로컬
ls ~/.claude/skills/symphony/SKILL.md  # 개인
```

Claude Code는 시작 시 자동으로 스킬을 검색하고 트리거 키워드가 사용될 때 활성화합니다.

---

## 빠른 시작

### 1. 플랜 파일 생성

`symphony-phases` 코드 블록이 포함된 마크다운 파일을 생성합니다. 프로젝트 루트 또는 `~/.claude/plans/`에 `plan.md`로 저장합니다:

```markdown
# API 구현 플랜

이 플랜은 인증이 포함된 REST API를 구현합니다.

\`\`\`symphony-phases
[
  {
    "id": "setup-database",
    "title": "Setup Database",
    "objective": "Initialize the database schema",
    "tasks": ["Create users table", "Create sessions table"],
    "dependencies": [],
    "complexity": "low",
    "required_context": {
      "files": [],
      "concepts": ["SQL", "Database design"],
      "artifacts_from": []
    },
    "success_criteria": "Database tables created successfully"
  },
  {
    "id": "implement-auth",
    "title": "Implement Authentication",
    "objective": "Add JWT-based authentication",
    "tasks": ["Create login endpoint", "Add auth middleware"],
    "dependencies": ["setup-database"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/routes/*.ts"],
      "concepts": ["JWT", "bcrypt"],
      "artifacts_from": ["setup-database"]
    },
    "success_criteria": "Login returns valid JWT token"
  }
]
\`\`\`
```

### 2. 오케스트레이션 트리거

Claude Code와의 대화에서 트리거 키워드 중 하나를 사용합니다:

```
conduct the plan
```

또는

```
orchestrate my implementation plan
```

Symphony가 플랜을 파싱하고 의존성을 해결한 후 페이즈 실행을 시작합니다.

---

## 작동 방식

### Plan Mode 통합

Symphony는 Claude Code의 Plan Mode 워크플로우와 통합됩니다:

1. **플랜 생성**: Plan Mode를 사용하여 상세한 구현 플랜 생성
2. **symphony-phases 블록 추가**: `symphony-phases` JSON 블록으로 플랜 구조화
3. **Plan Mode 종료**: 플래닝 세션 완료
4. **실행**: "conduct" 또는 다른 트리거 키워드를 사용하여 오케스트레이션 시작

### DAG 기반 의존성 해결

Symphony는 위상 정렬을 위해 Kahn 알고리즘을 사용합니다:

- **순환 감지**: 의존성 그래프가 유효한지 확인합니다 (순환 의존성 없음)
- **실행 순서 결정**: 어떤 페이즈가 병렬로 실행될 수 있는지 계산합니다
- **준비된 페이즈 식별**: 모든 의존성이 완료된 페이즈를 찾습니다

```
Level 0: [setup-database, setup-config]     <- 의존성 없음, 병렬 실행
Level 1: [implement-auth, implement-api]    <- level 0에 의존
Level 2: [integration-tests]                <- level 1에 의존
```

### Task 도구를 통한 병렬 실행

페이즈는 Claude Code의 Task 도구를 사용하여 실행됩니다:

- 각 페이즈는 독립적인 태스크로 실행됩니다
- 여러 태스크가 동시에 실행될 수 있습니다 (최대 4개 권장)
- 태스크는 목표, 컨텍스트, 아티팩트가 포함된 구조화된 프롬프트를 받습니다

### 아티팩트 전파

페이즈가 완료되면 의존 페이즈에 전달되는 아티팩트(생성된 파일, 내보내기, 노트)를 생성할 수 있습니다:

1. 페이즈 A가 완료되고 아티팩트를 보고합니다
2. Symphony가 아티팩트를 상태에 저장합니다
3. 페이즈 B(`artifacts_from`에 A가 나열됨)가 시작되면 프롬프트에서 A의 아티팩트를 받습니다

---

## 자동 재시도

Symphony는 지능적인 에러 분류와 지수 백오프를 사용하여 실패한 페이즈를 자동으로 재시도합니다.

### 기본 재시도 정책

설정 없이 자동으로 적용됩니다:

| 설정 | 값 |
|------|-----|
| 최대 재시도 | 2 (총 3회 시도) |
| 백오프 전략 | 지터가 포함된 지수 백오프 |
| 초기 지연 | 5초 |
| 최대 지연 | 60초 |

### 에러 분류

에러는 재시도 동작을 결정하기 위해 자동으로 분류됩니다:

| 카테고리 | 예시 | 자동 재시도 |
|---------|------|-----------|
| `transient` | Rate limit, timeout, 503 에러 | 예 |
| `resource` | 파일을 찾을 수 없음, 권한 거부 | 예 |
| `timeout` | 페이즈 실행 타임아웃 | 예 |
| `unknown` | 분류되지 않은 에러 | 예 |
| `logic` | 테스트 실패, 타입 에러, lint 에러 | 아니오 |
| `permanent` | 문법 에러, 잘못된 설정 | 아니오 |

### 사용자 결정 흐름

모든 재시도가 소진되면 옵션을 선택하라는 메시지가 표시됩니다:

```
Phase "build-frontend" failed after 3 attempts.
Error: Connection timeout (category: transient)

What would you like to do?
[1] Retry once more
[2] Skip phase (continue with dependents)
[3] Abort branch (stop this and dependent phases)
[4] Abort all (stop entire orchestration)
```

---

## 상태 표시줄 시각화

Claude Code의 상태 표시줄에 실시간 오케스트레이션 진행 상황을 표시합니다.

### 출력 형식

```
[████░░░░░░] 4/10 (1!) | setup-db, auth-middleware
```

- **진행 막대**: 완료된 부분은 녹색, 남은 부분은 회색
- **카운트**: 완료/전체 페이즈
- **실패**: 실패가 있으면 빨간색 표시 (예: `(1!)`)
- **실행 중인 페이즈**: 현재 실행 중인 페이즈 이름은 노란색

### 설정

`.claude/settings.json`에 추가합니다. 자세한 내용은 [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline)을 참조하세요.

**프로젝트 로컬 스킬:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun .claude/skills/symphony/scripts/statusline.ts"
  }
}
```

**개인 스킬:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun ~/.claude/skills/symphony/scripts/statusline.ts"
  }
}
```

### 종료 상태

| 상태 | 표시 |
|-----|------|
| 실행 중 | `[████░░░░░░] 4/10 \| phase-names` |
| 완료 | `[Done] 10/10` (녹색) |
| 실패 | `[Failed] 7/10` (빨간색) |
| 중단됨 | `[Aborted] 5/10` (회색) |
| 실행 안 함 | (출력 없음) |

### 다른 상태 표시줄과 결합

Symphony 상태를 다른 정보와 결합하려면 래퍼 스크립트를 생성합니다:

```bash
#!/bin/bash
# ~/.claude/statusline-wrapper.sh

symphony=$(bun .claude/skills/symphony/scripts/statusline.ts 2>/dev/null)
git_branch=$(git branch --show-current 2>/dev/null)

parts=()
[ -n "$symphony" ] && parts+=("$symphony")
[ -n "$git_branch" ] && parts+=("$git_branch")

IFS=' | '
echo "${parts[*]}"
```

---

## 트리거 키워드

Symphony 스킬은 다음 키워드 중 하나를 사용할 때 활성화됩니다:

| 키워드 | 언어 |
|-------|------|
| `conduct` | 영어 |
| `orchestrate` | 영어 |
| `execute plan` | 영어 |
| `run phases` | 영어 |
| `symphony` | 영어 |

**참고**: 한국어 사용자를 위해 한국어 트리거 키워드도 지원됩니다.

---

## 플랜 파일 형식

플랜은 `symphony-phases` 코드 블록이 포함된 마크다운 파일입니다:

```markdown
# 프로젝트 플랜 제목

프로젝트 및 목표에 대한 설명...

\`\`\`symphony-phases
[
  { "id": "phase-1", ... },
  { "id": "phase-2", ... }
]
\`\`\`

추가 노트 또는 문서...
```

### 플랜 검색

Symphony는 다음 순서로 플랜을 검색합니다:

1. 대화 컨텍스트에서 제공된 플랜 경로
2. `~/.claude/plans/`에서 가장 최근에 수정된 `.md` 파일
3. 현재 작업 디렉토리의 `plan.md`

---

## 페이즈 스키마

`symphony-phases` 배열의 각 페이즈는 다음 필드가 필요합니다:

| 필드 | 타입 | 필수 | 설명 |
|-----|------|-----|------|
| `id` | string | 예 | 고유 식별자 (kebab-case, 최대 64자) |
| `title` | string | 예 | 사람이 읽을 수 있는 이름 |
| `objective` | string | 예 | 명확한 목표 설명 |
| `tasks` | string[] | 예 | 구체적인 작업 항목 (최소 1개) |
| `dependencies` | string[] | 아니오 | 먼저 완료해야 하는 페이즈의 ID |
| `complexity` | "low" \| "medium" \| "high" | 아니오 | 작업 수준 (기본값: "medium") |
| `required_context.files` | string[] | 아니오 | 컨텍스트에 포함할 파일 경로 |
| `required_context.concepts` | string[] | 아니오 | 필요한 도메인 지식 |
| `required_context.artifacts_from` | string[] | 아니오 | 아티팩트를 받을 페이즈 ID |
| `success_criteria` | string | 예 | 검증 가능한 완료 조건 |
| `constraints` | string[] | 아니오 | 페이즈가 하지 말아야 할 것들 |

### 페이즈 예시

```json
{
  "id": "implement-user-auth",
  "title": "Implement User Authentication",
  "objective": "Add JWT-based authentication to the API",
  "tasks": [
    "Create auth middleware for JWT verification",
    "Implement login endpoint with password hashing",
    "Add protected route decorator"
  ],
  "dependencies": ["setup-database"],
  "complexity": "high",
  "required_context": {
    "files": ["src/routes/*.ts", "src/middleware/*.ts"],
    "concepts": ["JWT tokens", "bcrypt password hashing"],
    "artifacts_from": ["setup-database"]
  },
  "success_criteria": "Login returns valid JWT, protected routes reject invalid tokens",
  "constraints": [
    "Do not store plain-text passwords",
    "Do not expose internal error messages"
  ]
}
```

전체 스키마 문서는 [references/phase-schema.md](references/phase-schema.md)를 참조하세요.

---

## CLI 스크립트

Symphony 스킬은 `scripts/` 디렉토리에 CLI 스크립트를 포함합니다:

### 핵심 스크립트

| 스크립트 | 용도 |
|---------|-----|
| `find-latest-plan.ts` | `symphony-phases` 블록이 있는 가장 최근 플랜 파일 찾기 |
| `parse-plan.ts` | 플랜 파일을 파싱하고 검증하여 JSON으로 페이즈 출력 |
| `init-state.ts` | 오케스트레이션을 위한 `.symphony-state.json` 파일 초기화 |
| `get-ready-phases.ts` | 실행 준비가 된 페이즈 반환 (의존성 충족) |
| `mark-complete.ts` | 페이즈를 완료로 표시하고 아티팩트 저장 |
| `mark-failed.ts` | 자동 재시도 로직으로 페이즈 실패 처리 |
| `validate-skill.ts` | SKILL.md 프론트매터 검증 |

### 재시도 및 복구 스크립트

| 스크립트 | 용도 |
|---------|-----|
| `classify-error.ts` | 에러 메시지를 카테고리로 분류 (transient, logic 등) |
| `retry-phase.ts` | 지수 백오프로 페이즈 재시도 예약 |
| `resolve-decision.ts` | 재시도 소진 후 사용자 결정 처리 |

### 시각화 스크립트

| 스크립트 | 용도 |
|---------|-----|
| `statusline.ts` | Claude Code의 상태 표시줄용 오케스트레이션 진행 상황 출력 |

### 사용 예시

```bash
# 최신 플랜 파일 찾기
bun .claude/skills/symphony/scripts/find-latest-plan.ts

# 특정 플랜 파싱
bun .claude/skills/symphony/scripts/parse-plan.ts ./plan.md

# 오케스트레이션을 위한 상태 초기화
bun .claude/skills/symphony/scripts/init-state.ts ./plan.md -o .symphony-state.json

# 상태에서 준비된 페이즈 가져오기
bun .claude/skills/symphony/scripts/get-ready-phases.ts .symphony-state.json

# 아티팩트와 함께 페이즈를 완료로 표시
bun .claude/skills/symphony/scripts/mark-complete.ts .symphony-state.json setup-phase '[{"type":"file_created","path":"src/db.ts"}]'

# 페이즈를 실패로 표시
bun .claude/skills/symphony/scripts/mark-failed.ts .symphony-state.json build-phase "Compilation error"
```

---

## 예제 워크플로우

Symphony를 사용하여 기능 구현을 조율하는 전체 예제입니다:

### 1단계: 플랜 생성

```markdown
# 사용자 프로필 기능

애플리케이션의 사용자 프로필 관리를 구현합니다.

\`\`\`symphony-phases
[
  {
    "id": "create-profile-model",
    "title": "Create Profile Model",
    "objective": "Define the user profile data model",
    "tasks": [
      "Create Profile interface in src/models/profile.ts",
      "Add profile fields: bio, avatar, preferences"
    ],
    "dependencies": [],
    "complexity": "low",
    "required_context": {
      "files": ["src/models/user.ts"],
      "concepts": ["TypeScript interfaces"],
      "artifacts_from": []
    },
    "success_criteria": "Profile interface exported and documented"
  },
  {
    "id": "profile-api-routes",
    "title": "Profile API Routes",
    "objective": "Create CRUD endpoints for user profiles",
    "tasks": [
      "GET /profile/:id - Fetch profile",
      "PUT /profile/:id - Update profile",
      "POST /profile/:id/avatar - Upload avatar"
    ],
    "dependencies": ["create-profile-model"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/routes/*.ts"],
      "concepts": ["REST API", "Express routing"],
      "artifacts_from": ["create-profile-model"]
    },
    "success_criteria": "All endpoints return correct responses"
  },
  {
    "id": "profile-tests",
    "title": "Profile Tests",
    "objective": "Write tests for profile functionality",
    "tasks": [
      "Unit tests for profile model",
      "Integration tests for API endpoints"
    ],
    "dependencies": ["profile-api-routes"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/__tests__/*.ts"],
      "concepts": ["Testing", "Jest/Bun test"],
      "artifacts_from": ["profile-api-routes"]
    },
    "success_criteria": "All tests pass with 80%+ coverage"
  }
]
\`\`\`
```

### 2단계: 오케스트레이션 시작

```
User: conduct the profile feature plan
```

### 3단계: Symphony 실행

Symphony는 다음을 수행합니다:

1. 플랜을 파싱하고 페이즈를 검증합니다
2. `.symphony-state.json`에 상태를 초기화합니다
3. `create-profile-model`을 시작합니다 (의존성 없음)
4. 완료되면 `profile-api-routes`를 시작합니다
5. 완료되면 `profile-tests`를 시작합니다
6. 모든 아티팩트와 함께 최종 요약을 보고합니다

### 4단계: 결과 확인

```
Symphony Performance Complete

Total phases: 3
Completed: 3
Failed: 0
Duration: 12m 34s

Phase Results:
- create-profile-model: complete (2m 15s)
- profile-api-routes: complete (5m 42s)
- profile-tests: complete (4m 37s)

Artifacts Created:
- src/models/profile.ts
- src/routes/profile.ts
- src/__tests__/profile.test.ts
```

---

## 상태 관리

Symphony는 `.symphony-state.json`에서 실행 상태를 추적합니다:

```json
{
  "planPath": "/path/to/plan.md",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "phases": {
    "create-profile-model": {
      "status": "complete",
      "startedAt": "2024-01-15T10:30:01.000Z",
      "completedAt": "2024-01-15T10:32:15.000Z",
      "artifacts": [
        { "type": "file_created", "path": "src/models/profile.ts" }
      ]
    },
    "profile-api-routes": {
      "status": "running",
      "startedAt": "2024-01-15T10:32:16.000Z",
      "artifacts": []
    },
    "profile-tests": {
      "status": "pending",
      "artifacts": []
    }
  },
  "completedCount": 1,
  "failedCount": 0,
  "status": "running"
}
```

### 페이즈 상태

| 상태 | 설명 |
|-----|------|
| `pending` | 아직 준비되지 않음 (의존성 미완료) |
| `ready` | 의존성 완료, 시작 가능 |
| `running` | 현재 실행 중 |
| `complete` | 성공적으로 완료 |
| `retrying` | 실패했지만 재시도 예정 (백오프 대기 중) |
| `awaiting_decision` | 재시도 소진, 사용자 결정 대기 중 |
| `failed` | 영구적으로 실패 (사용자가 재시도하지 않기로 선택) |
| `blocked` | 의존성이 실패하거나 중단됨 |
| `aborted` | 사용자가 취소함 |

### 실패 처리

페이즈가 실패하면 Symphony는 재시도 흐름을 따릅니다:

1. **에러 분류**: 에러가 분류됩니다 (transient, logic, permanent 등)
2. **재시도 확인**: 재시도 가능하고 재시도 횟수가 남아있으면 페이즈가 `retrying` 상태로 전환
3. **백오프 대기**: 다음 시도 전 지수 백오프 지연
4. **재시도 실행**: 페이즈가 `ready`로 이동하여 재실행
5. **사용자 결정**: 모든 재시도가 실패하면 사용자가 선택: retry/skip/abort

주요 동작:
- 재시도 시도 중에는 의존 페이즈가 **차단되지 않습니다**
- 사용자가 "abort branch" 또는 "abort all"을 선택한 경우에만 의존 페이즈가 차단됩니다
- "skip phase"를 선택하면 의존 페이즈가 진행할 수 있습니다
- 독립 페이즈는 실패와 관계없이 계속 실행됩니다

---

## 추가 리소스

- [Phase Schema Reference](references/phase-schema.md) - 전체 필드 문서
- [Orchestration Workflow](references/orchestration-workflow.md) - 상세 실행 모델
- [Prompt Template](references/prompt-template.md) - 워커 프롬프트 구조

---

## 라이선스

이 스킬은 Symphony 프로젝트의 일부입니다.
