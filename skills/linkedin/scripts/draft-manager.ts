/**
 * LinkedIn 초안 관리 유틸리티
 *
 * 발행 실패 시 초안 자동 저장 및 관리
 *
 * 사용법:
 *   bun run draft-manager.ts save --content "포스트 내용" --reason "NETWORK_ERROR"
 *   bun run draft-manager.ts list
 *   bun run draft-manager.ts get --id "draft-uuid"
 *   bun run draft-manager.ts delete --id "draft-uuid"
 */

import { parseArgs } from "util";
import { randomUUID } from "crypto";

const DRAFTS_PATH = "/Users/xavier/code/LinkedIn/data/drafts";

// 타입 정의
type FailureReason =
  | "SESSION_EXPIRED"
  | "NETWORK_ERROR"
  | "PUBLISH_ERROR"
  | "IMAGE_UPLOAD_ERROR"
  | "MANUAL_SAVE"
  | "SCHEDULE_ERROR";

interface DraftMetadata {
  purpose?: string;
  target_audience?: string;
  format?: "how-to" | "tips" | "news" | "story";
  ab_version?: "A" | "B";
}

interface Draft {
  id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "failed_publish" | "pending_retry";
  failure_reason?: FailureReason;
  content: string;
  image_path: string | null;
  metadata: DraftMetadata;
  retry_count: number;
}

// 초안 파일 경로 생성
function getDraftPath(draftId: string): string {
  return `${DRAFTS_PATH}/${draftId}.json`;
}

// 초안 저장
async function saveDraft(options: {
  content: string;
  imagePath?: string;
  reason?: FailureReason;
  metadata?: DraftMetadata;
  existingId?: string;
}): Promise<Draft> {
  const now = new Date().toISOString();
  const draftId = options.existingId || `draft-${randomUUID()}`;

  let draft: Draft;

  // 기존 초안 업데이트 또는 새로 생성
  if (options.existingId) {
    const existing = await getDraft(options.existingId);
    if (existing) {
      draft = {
        ...existing,
        updated_at: now,
        content: options.content,
        image_path: options.imagePath || existing.image_path,
        retry_count: existing.retry_count + 1
      };

      if (options.reason) {
        draft.status = "failed_publish";
        draft.failure_reason = options.reason;
      }
    } else {
      throw new Error(`기존 초안을 찾을 수 없습니다: ${options.existingId}`);
    }
  } else {
    draft = {
      id: draftId,
      created_at: now,
      updated_at: now,
      status: options.reason ? "failed_publish" : "draft",
      failure_reason: options.reason,
      content: options.content,
      image_path: options.imagePath || null,
      metadata: options.metadata || {},
      retry_count: 0
    };
  }

  // 파일 저장
  const draftPath = getDraftPath(draft.id);
  await Bun.write(draftPath, JSON.stringify(draft, null, 2));

  return draft;
}

// 초안 조회
async function getDraft(draftId: string): Promise<Draft | null> {
  try {
    const file = Bun.file(getDraftPath(draftId));
    if (await file.exists()) {
      return await file.json();
    }
  } catch (error) {
    console.error("초안 읽기 실패:", error);
  }
  return null;
}

// 초안 목록 조회
async function listDrafts(): Promise<Draft[]> {
  const drafts: Draft[] = [];

  const glob = new Bun.Glob("*.json");
  for await (const file of glob.scan(DRAFTS_PATH)) {
    try {
      const draft = await Bun.file(`${DRAFTS_PATH}/${file}`).json();
      drafts.push(draft);
    } catch (error) {
      console.error(`파일 읽기 실패: ${file}`, error);
    }
  }

  // 최신순 정렬
  return drafts.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

// 실패한 초안만 조회
async function getFailedDrafts(): Promise<Draft[]> {
  const allDrafts = await listDrafts();
  return allDrafts.filter(d => d.status === "failed_publish");
}

// 초안 삭제
async function deleteDraft(draftId: string): Promise<boolean> {
  const draftPath = getDraftPath(draftId);
  const file = Bun.file(draftPath);

  if (await file.exists()) {
    const { unlinkSync } = await import("fs");
    unlinkSync(draftPath);
    return true;
  }

  return false;
}

// 초안 상태 업데이트
async function updateDraftStatus(
  draftId: string,
  status: Draft["status"],
  reason?: FailureReason
): Promise<boolean> {
  const draft = await getDraft(draftId);
  if (!draft) return false;

  draft.status = status;
  draft.updated_at = new Date().toISOString();
  if (reason) {
    draft.failure_reason = reason;
  }

  await Bun.write(getDraftPath(draftId), JSON.stringify(draft, null, 2));
  return true;
}

// 실패 이유 한글 변환
function getFailureReasonText(reason: FailureReason): string {
  const reasons: Record<FailureReason, string> = {
    SESSION_EXPIRED: "세션 만료",
    NETWORK_ERROR: "네트워크 오류",
    PUBLISH_ERROR: "발행 실패",
    IMAGE_UPLOAD_ERROR: "이미지 업로드 실패",
    MANUAL_SAVE: "수동 저장",
    SCHEDULE_ERROR: "예약 설정 실패"
  };
  return reasons[reason] || reason;
}

// 상태 라벨 변환
function getStatusLabel(status: Draft["status"]): string {
  const labels: Record<Draft["status"], string> = {
    draft: "초안",
    failed_publish: "발행실패",
    pending_retry: "재시도대기"
  };
  return labels[status] || status;
}

// CLI 실행
async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      content: { type: "string" },
      id: { type: "string" },
      reason: { type: "string" },
      image: { type: "string" },
      purpose: { type: "string" },
      audience: { type: "string" },
      format: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  const command = positionals[0];

  if (values.help || !command) {
    console.log(`
LinkedIn 초안 관리

사용법:
  bun run draft-manager.ts <command> [options]

명령어:
  save      초안 저장
  list      초안 목록 조회
  failed    실패한 초안만 조회
  get       특정 초안 조회
  delete    초안 삭제
  retry     초안 재시도 상태로 변경

옵션:
  --content   포스트 내용 (save 시 필수)
  --id        초안 ID
  --reason    실패 이유 (SESSION_EXPIRED, NETWORK_ERROR, PUBLISH_ERROR, IMAGE_UPLOAD_ERROR)
  --image     이미지 경로
  --purpose   포스트 목적
  --audience  타겟 독자
  --format    포맷 (how-to, tips, news, story)
  -h, --help  도움말 표시

예시:
  bun run draft-manager.ts save --content "포스트 내용" --reason "NETWORK_ERROR"
  bun run draft-manager.ts list
  bun run draft-manager.ts get --id "draft-abc123"
  bun run draft-manager.ts delete --id "draft-abc123"
    `);
    return;
  }

  switch (command) {
    case "save": {
      if (!values.content) {
        console.error("오류: --content 옵션이 필요합니다");
        process.exit(1);
      }

      const draft = await saveDraft({
        content: values.content,
        imagePath: values.image,
        reason: values.reason as FailureReason | undefined,
        metadata: {
          purpose: values.purpose,
          target_audience: values.audience,
          format: values.format as DraftMetadata["format"]
        }
      });

      console.log("초안 저장됨:");
      console.log(`  ID: ${draft.id}`);
      console.log(`  상태: ${draft.status}`);
      if (draft.failure_reason) {
        console.log(`  실패 이유: ${getFailureReasonText(draft.failure_reason)}`);
      }
      console.log(`  경로: ${getDraftPath(draft.id)}`);
      break;
    }

    case "list": {
      const drafts = await listDrafts();

      if (drafts.length === 0) {
        console.log("저장된 초안이 없습니다.");
        return;
      }

      console.log(`총 ${drafts.length}개 초안:\n`);
      drafts.forEach((draft, index) => {
        const date = new Date(draft.updated_at).toLocaleString("ko-KR");
        const statusLabel = getStatusLabel(draft.status);

        console.log(`${index + 1}. [${statusLabel}] ${draft.id}`);
        console.log(`   상태: ${draft.status}`);
        if (draft.failure_reason) {
          console.log(`   실패: ${getFailureReasonText(draft.failure_reason)}`);
        }
        console.log(`   수정: ${date}`);
        console.log(`   내용: ${draft.content.substring(0, 50)}...`);
        console.log();
      });
      break;
    }

    case "failed": {
      const failed = await getFailedDrafts();

      if (failed.length === 0) {
        console.log("실패한 초안이 없습니다.");
        return;
      }

      console.log(`실패한 초안 ${failed.length}개:\n`);
      failed.forEach((draft, index) => {
        const date = new Date(draft.updated_at).toLocaleString("ko-KR");
        console.log(`${index + 1}. ${draft.id}`);
        console.log(`   실패: ${getFailureReasonText(draft.failure_reason!)}`);
        console.log(`   재시도: ${draft.retry_count}회`);
        console.log(`   수정: ${date}`);
        console.log();
      });
      break;
    }

    case "get": {
      if (!values.id) {
        console.error("오류: --id 옵션이 필요합니다");
        process.exit(1);
      }

      const draft = await getDraft(values.id);
      if (draft) {
        console.log(JSON.stringify(draft, null, 2));
      } else {
        console.error("초안을 찾을 수 없습니다:", values.id);
      }
      break;
    }

    case "delete": {
      if (!values.id) {
        console.error("오류: --id 옵션이 필요합니다");
        process.exit(1);
      }

      const deleted = await deleteDraft(values.id);
      if (deleted) {
        console.log("초안 삭제됨:", values.id);
      } else {
        console.error("초안을 찾을 수 없습니다:", values.id);
      }
      break;
    }

    case "retry": {
      if (!values.id) {
        console.error("오류: --id 옵션이 필요합니다");
        process.exit(1);
      }

      const updated = await updateDraftStatus(values.id, "pending_retry");
      if (updated) {
        console.log("초안 상태 업데이트됨: pending_retry");
      } else {
        console.error("초안을 찾을 수 없습니다:", values.id);
      }
      break;
    }

    default:
      console.error("알 수 없는 명령어:", command);
      process.exit(1);
  }
}

// 모듈 내보내기
export {
  saveDraft,
  getDraft,
  listDrafts,
  getFailedDrafts,
  deleteDraft,
  updateDraftStatus,
  getFailureReasonText,
  getStatusLabel,
  Draft,
  DraftMetadata,
  FailureReason
};

// CLI 실행
main().catch(console.error);
