# LinkedIn 발행 Skill

Chrome MCP를 활용한 LinkedIn 포스트 발행 워크플로우

## 트리거

이 skill은 `/linkedin-post` 워크플로우의 마지막 단계에서 자동으로 호출됩니다.
직접 호출은 권장하지 않습니다.

---

## 사전 요구사항

1. **Chrome MCP 설치 확인**: mcp__claude-in-chrome__* 도구 사용 가능
2. **LinkedIn 로그인 상태**: 브라우저에서 LinkedIn에 로그인되어 있어야 함
3. **발행할 콘텐츠**: 사용자가 승인한 포스트 내용과 이미지(선택)

---

## 발행 워크플로우

### Step 1: 브라우저 탭 컨텍스트 확인

```
mcp__claude-in-chrome__tabs_context_mcp 호출
→ 현재 열린 탭 목록 확인
→ LinkedIn 탭이 있으면 해당 탭 사용
→ 없으면 새 탭 생성
```

### Step 2: LinkedIn 접속 및 로그인 상태 확인

```
새 탭 또는 기존 탭에서 LinkedIn 접속:
mcp__claude-in-chrome__navigate
→ url: "https://www.linkedin.com/feed/"

로그인 상태 확인:
mcp__claude-in-chrome__read_page
→ 프로필 아이콘 또는 로그인 버튼 확인

로그인 안 됨:
→ 사용자에게 수동 로그인 요청
→ "LinkedIn에 로그인이 필요합니다. 브라우저에서 로그인 후 다시 시도해주세요."
```

### Step 3: 새 포스트 작성 페이지 열기

```
포스트 시작 버튼 클릭:
mcp__claude-in-chrome__computer
→ action: "click"
→ coordinate: "Start a post" 버튼 위치

또는 직접 URL 접근:
mcp__claude-in-chrome__navigate
→ url: "https://www.linkedin.com/feed/?shareBoxButton=true"

포스트 작성 모달 대기:
mcp__claude-in-chrome__read_page
→ 모달 창 로드 확인 (최대 5초 대기)
```

### Step 4: 텍스트 입력

```
포스트 내용 입력:
mcp__claude-in-chrome__form_input
→ selector: "[data-test-id='share-box-input']" 또는 contenteditable div
→ text: {승인된 포스트 내용}

대안 방식:
mcp__claude-in-chrome__javascript_tool
→ document.querySelector('[role="textbox"]').innerText = `{포스트 내용}`
```

### Step 5: 이미지 업로드 (있는 경우)

```
이미지가 있는 경우:
1. 미디어 버튼 클릭
   mcp__claude-in-chrome__computer
   → action: "click"
   → coordinate: 미디어 아이콘 위치

2. 파일 업로드
   mcp__claude-in-chrome__upload_image
   → 로컬 이미지 경로에서 업로드

3. 업로드 완료 대기
   mcp__claude-in-chrome__read_page
   → 이미지 썸네일 확인 (최대 10초 대기)
```

### Step 6: 발행 실행

```
발행 버튼 클릭 전 확인:
mcp__claude-in-chrome__read_page
→ "Post" 또는 "게시" 버튼 활성화 상태 확인

발행 버튼 클릭:
mcp__claude-in-chrome__computer
→ action: "click"
→ coordinate: Post 버튼 위치

발행 완료 대기:
→ 모달 닫힘 확인
→ 성공 토스트 메시지 확인 (최대 10초)
```

### Step 7: URL 캡처 및 기록

```
발행된 포스트 URL 획득:
방법 1: 활동 피드에서 최신 포스트 URL 추출
mcp__claude-in-chrome__navigate
→ url: "https://www.linkedin.com/in/{profile}/recent-activity/all/"

mcp__claude-in-chrome__javascript_tool
→ 최신 포스트의 permalink 추출

방법 2: 알림에서 포스트 링크 확인
→ 발행 직후 나타나는 "View post" 링크 캡처
```

---

## 발행 후 처리

### posts-history.json 업데이트

발행 성공 시 다음 정보를 기록:

```json
{
  "id": "자동생성 UUID",
  "linkedin_url": "캡처된 포스트 URL",
  "published_at": "발행 시각 ISO 포맷",
  "content": "포스트 전체 내용",
  "format_type": "how-to | tips | news | story",
  "image_path": "이미지 경로 또는 null",
  "scheduled": false,
  "analytics": null
}
```

---

## 오류 처리

### 로그인 만료

```
증상: 로그인 페이지로 리다이렉트
대응:
1. 사용자에게 알림
2. 초안을 data/drafts/에 저장
3. 수동 로그인 요청

메시지:
"❌ LinkedIn 세션이 만료되었습니다.
→ 브라우저에서 LinkedIn에 로그인해주세요.
→ 초안이 자동 저장되었습니다: data/drafts/{draft-id}.json"
```

### 네트워크 오류

```
증상: 페이지 로드 실패, 타임아웃
대응:
1. 최대 3회 재시도 (5초 간격)
2. 실패 시 초안 저장
3. 사용자에게 네트워크 확인 요청

메시지:
"❌ 네트워크 오류로 발행에 실패했습니다.
→ 네트워크 연결을 확인해주세요.
→ 초안이 자동 저장되었습니다."
```

### 발행 실패

```
증상: Post 버튼 비활성화, 오류 메시지 표시
대응:
1. 오류 메시지 캡처
2. 초안 저장
3. 상세 오류 정보 제공

메시지:
"❌ LinkedIn 발행에 실패했습니다.
→ 오류: {캡처된 오류 메시지}
→ 초안이 자동 저장되었습니다."
```

### 이미지 업로드 실패

```
증상: 이미지 업로드 타임아웃, 형식 오류
대응:
1. 텍스트만 발행할지 사용자에게 확인
2. 이미지 형식/크기 검증 결과 안내

메시지:
"⚠️ 이미지 업로드에 실패했습니다.
→ 텍스트만 발행하시겠습니까? (y/n)
→ 이미지 형식: PNG, JPG, GIF, WEBP만 지원
→ 최대 크기: 8MB"
```

---

## 초안 저장 형식

실패 시 저장되는 초안 형식:

```json
{
  "id": "draft-{uuid}",
  "created_at": "2025-01-14T10:00:00Z",
  "updated_at": "2025-01-14T10:00:00Z",
  "status": "failed_publish",
  "failure_reason": "SESSION_EXPIRED | NETWORK_ERROR | PUBLISH_ERROR",
  "content": "포스트 전체 내용",
  "image_path": "images/20250114_001.png",
  "metadata": {
    "purpose": "사용자 입력 목적",
    "target_audience": "타겟 독자",
    "format": "how-to"
  },
  "retry_count": 0
}
```

---

## 성공 메시지 형식

```
✅ LinkedIn 포스트가 발행되었습니다!

📝 포스트 URL: https://www.linkedin.com/posts/...
📅 발행 시각: 2025년 1월 14일 오전 10:30
🖼️ 이미지: 포함됨 (20250114_001.png)

💾 posts-history.json에 기록되었습니다.
```

---

## 주의사항

### LinkedIn 정책 준수

- 과도한 자동화 지양 (하루 5개 이내 포스트 권장)
- 스팸성 콘텐츠 금지
- LinkedIn 이용약관 준수

### 브라우저 자동화 안정성

- 요소 로드 후 적절한 대기 시간 (1-2초)
- 클릭 전 요소 존재 확인
- 네트워크 지연 고려한 타임아웃 설정

### 사용자 경험

- 발행 전 항상 미리보기 확인 받기
- 발행 진행 상황 실시간 업데이트
- 실패 시 명확한 오류 메시지와 해결 방안 제공
