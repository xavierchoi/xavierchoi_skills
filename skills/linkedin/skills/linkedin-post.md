# LinkedIn Post Skill

LinkedIn 포스트를 대화형으로 작성하고 발행하는 Skill입니다.

## Metadata

```yaml
name: linkedin-post
version: 1.0.0
description: LinkedIn 포스트 작성 및 발행 워크플로우
triggers:
  slash_commands:
    - /linkedin-post
  natural_language:
    - "LinkedIn에 포스트 작성해줘"
    - "LinkedIn 포스트 써줘"
    - "링크드인 글 써줘"
    - "링크드인에 올릴 글 작성해줘"
dependencies:
  - chrome-mcp
  - frontend-for-opus-4.5
data_paths:
  style_guide: /Users/xavier/code/LinkedIn/data/style-guide.json
  posts_history: /Users/xavier/code/LinkedIn/data/posts-history.json
  drafts: /Users/xavier/code/LinkedIn/data/drafts/
  images: /Users/xavier/code/LinkedIn/images/
```

---

## 워크플로우

### Step 1: 작성 전 질문

사용자가 `/linkedin-post [주제/아이디어]`를 입력하면 다음 3가지를 질문합니다:

```markdown
LinkedIn 포스트를 작성하기 전에 몇 가지 여쭤볼게요:

1. **포스트 목적/목표**: 이 포스트로 달성하고 싶은 것이 무엇인가요?
   - 예: 지식 공유, 인사이트 전달, 제품 홍보, 토론 유발

2. **타겟 독자**: 누구를 위한 글인가요?
   - 예: 개발자, PM, 비즈니스 리더, Claude 초보자

3. **포맷 선호도**: 어떤 형식이 좋을까요?
   - How-to/튜토리얼
   - 팁/인사이트
   - 소식/업데이트
   - 스토리/경험담
```

### Step 2: 외부 참고 콘텐츠 분석 (선택적)

사용자가 외부 링크나 콘텐츠를 제공하면:

1. WebFetch 또는 Read 도구로 콘텐츠 분석
2. 핵심 포인트 추출
3. 포스트에 반영할 인사이트 정리

```markdown
참고 콘텐츠를 분석했습니다:

**핵심 포인트:**
- [추출된 핵심 내용 1]
- [추출된 핵심 내용 2]

이 내용을 바탕으로 포스트 초안을 작성하겠습니다.
```

### Step 3: A/B 테스트용 초안 생성

`prompts/ab-generator.md` 프롬프트를 사용하여 2개의 초안을 생성합니다.

**필수 참조 파일:**
- `/Users/xavier/code/LinkedIn/data/style-guide.json` (문체 가이드)
- `prompts/post-writer.md` (작성 가이드라인)

**출력 형식:**
```markdown
## 버전 A: [구조 설명]
[포스트 내용]

---

## 버전 B: [구조 설명]
[포스트 내용]

---

어떤 버전이 마음에 드시나요?
선택하시거나, 수정하고 싶은 부분을 말씀해주세요.
```

### Step 4: 버전 선택 및 피드백 반영

사용자가 버전을 선택하거나 피드백을 제공하면:

1. 선택된 버전을 기반으로 수정
2. 피드백 반영하여 새 버전 생성
3. **무제한 iteration** - 사용자가 만족할 때까지 반복

```markdown
[수정된 포스트 내용]

---

이 버전은 어떠신가요?
추가 수정이 필요하시면 말씀해주세요.
```

### Step 5: 이미지 첨부 (선택적)

사용자가 이미지를 제공하면:

1. 이미지를 `/Users/xavier/code/LinkedIn/images/` 폴더에 저장
2. 네이밍 규칙: `YYYYMMDD_NNN.ext` (예: `20250114_001.png`)
3. 포스트에 이미지 연결

```markdown
이미지를 저장했습니다: `images/20250114_001.png`
포스트와 함께 업로드하겠습니다.
```

### Step 6: HTML 미리보기 생성

`frontend-for-opus-4.5` Skill을 사용하여 LinkedIn 스타일 미리보기 생성:

```markdown
미리보기를 생성했습니다. 브라우저에서 확인해주세요.

[미리보기 파일 경로]

발행을 진행할까요?
```

**미리보기 요구사항:**
- LinkedIn 피드 스타일 모방
- 프로필 사진, 이름, 직함 표시
- 포스트 본문 렌더링
- 이미지 포함 시 이미지 미리보기
- 좋아요/댓글/공유 버튼 (비활성)

### Step 7: 발행 승인 및 실행

사용자가 발행을 승인하면:

1. **발행 전 최종 확인 메시지 표시**
2. Chrome MCP를 통해 LinkedIn 발행 실행
3. 발행 완료 후 URL 캡처
4. `posts-history.json`에 기록

```markdown
LinkedIn에 포스트를 발행했습니다!

🔗 포스트 URL: [LinkedIn URL]
📅 발행 시각: [시각]

포스트 히스토리에 저장되었습니다.
```

---

## Chrome MCP 발행 워크플로우

```
1. LinkedIn 웹 열기 (https://www.linkedin.com)
2. 로그인 상태 확인
3. 새 포스트 작성 버튼 클릭
4. 포스트 텍스트 입력
5. 이미지 업로드 (있는 경우)
6. 발행 버튼 클릭
7. 발행 완료 확인
8. 포스트 URL 캡처
```

---

## 오류 처리

### 세션 만료
```markdown
LinkedIn 세션이 만료되었습니다.

자동 재로그인을 시도 중...

[성공 시] 재로그인 완료. 발행을 계속합니다.
[실패 시] 브라우저에서 LinkedIn에 직접 로그인 후 다시 시도해주세요.
```

### 발행 실패
```markdown
발행 중 오류가 발생했습니다.

상세:
- 에러: [에러 메시지]
- 시각: [시각]

초안이 자동 저장되었습니다: `data/drafts/[id].json`

수동 발행 방법:
1. LinkedIn.com에서 직접 새 포스트 작성
2. 아래 내용을 복사하여 붙여넣기

---
[포스트 내용]
---
```

---

## 제약사항

- **언어**: 한국어 전용
- **주제**: Anthropic 제품 관련 콘텐츠 (Claude Code, Claude.ai, API 등)
- **길이**: 최대 1500자
- **해시태그**: 사용 안 함
- **이모지**: 제목/마무리에만 사용 (최소한으로)
- **발행**: 항상 미리보기 + 사용자 승인 필수

---

## 관련 파일

- `prompts/post-writer.md`: 포스트 작성 상세 가이드라인
- `prompts/ab-generator.md`: A/B 테스트 초안 생성 프롬프트
- `prompts/tone-analyzer.md`: 문체 분석 프롬프트
- `templates/preview.html`: HTML 미리보기 템플릿
