# Claude Vault

> AI-Native 개인 지식 관리 시스템 (Obsidian용)
> 주요 인터페이스: Claude Code | 저장소: Obsidian + iCloud

## 개요

Claude Vault는 Obsidian을 수동적인 노트 저장소에서 능동적인 사고 파트너로 변환합니다. 파일을 직접 정리하고 메뉴를 클릭하는 대신, Claude Code와의 자연어 대화를 통해 지식 베이스와 상호작용합니다.

## 설치

### 1. Marketplace 추가

```bash
/plugin marketplace add xavierchoi/xavierchoi_skills
```

### 2. 플러그인 설치

```bash
/plugin install claude-vault@xavierchoi-skills-marketplace
```

### 3. Claude Code 재시작

새 플러그인을 로드하려면 재시작하세요.

## 빠른 시작

```bash
# Obsidian vault로 이동
cd ~/Documents/YourObsidianVault

# Claude Code 시작
claude

# vault 구조 초기화
/vault-init
```

그런 다음 자연어로 사용하세요:
- "AI 에이전트에 대한 아이디어 저장해줘"
- "오늘 하루 시작"
- "인박스에 뭐 있어?"
- "주간 리뷰"

## 스킬

| 스킬 | 기능 | 트리거 예시 |
|------|------|-------------|
| **vault-capture** | 생각을 빠르게 Inbox에 저장 | "이거 기억해둬...", "메모해줘..." |
| **vault-process** | Inbox 항목 정리 및 분류 | "인박스 정리해줘", "노트 정리" |
| **vault-daily** | 오늘의 일일 노트 생성/수정 | "오늘 시작", "데일리 로그" |
| **vault-weekly** | 하이라이트와 함께 주간 리뷰 생성 | "주간 리뷰", "이번 주 어땠어?" |
| **vault-project** | 새 프로젝트 구조 생성 | "프로젝트 시작...", "새 프로젝트:" |
| **vault-search** | 콘텐츠, 태그, 메타데이터로 노트 검색 | "~에 대한 노트 찾아줘", "검색..." |
| **vault-status** | 프로젝트 진행 상황 확인 | "프로젝트 상태", "뭐가 진행 중이야?" |
| **vault-moc** | Map of Content 생성/수정 | "~에 대한 개요 만들어줘", "노트 인덱스..." |
| **vault-archive** | 완료된 항목을 아카이브로 이동 | "이 프로젝트 아카이브", "이건 끝났어" |

## 폴더 구조 (PARA 방법론)

```
Your Vault/
├── 00_Inbox/           # 빠른 캡처 영역
├── 01_Projects/        # 활성 프로젝트 (목표 + 기한)
├── 02_Areas/           # 지속적인 책임 영역
├── 03_Resources/       # 참고 자료
├── 04_Archive/         # 완료된 항목
├── 05_MOC/             # Map of Content
├── 06_Daily/           # 일일 노트 & 주간 리뷰
│   ├── daily/
│   └── weekly/
└── 07_Templates/       # 노트 템플릿
```

## Frontmatter

### 필수 필드 (모든 노트)

```yaml
---
type: fleeting | permanent | project | daily | weekly | moc | area
created: YYYY-MM-DD
tags: []
---
```

### 타입별 추가 필드

| 타입 | 추가 필드 |
|------|-----------|
| project | `project`, `status`, `due` |
| permanent | `topic`, `source`, `source_url` |
| daily | `date`, `mood`, `energy` |
| weekly | `week`, `date_start`, `date_end` |

## 태그 시스템

```
주제:   ai, ai/agents, programming, productivity
상태:   status/inbox, status/wip, status/review, status/done
형식:   format/article, format/book, format/paper
행동:   action/read, action/write, action/contact
```

## 워크플로우

```
[캡처] → 00_Inbox (fleeting)
    ↓ 처리
[정리] → 01_Projects | 02_Areas | 03_Resources
    ↓ 축적
[연결] → 05_MOC에서 구조화
    ↓ 완료
[아카이브] → 04_Archive
```

## 라이선스

MIT

## 작성자

최훈민 (Xavier Choi)
- 이메일: internetbasedboy@gmail.com
- GitHub: https://github.com/xavierchoi
