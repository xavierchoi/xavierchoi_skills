/**
 * LinkedIn 포스트 히스토리 관리 유틸리티
 *
 * 사용법:
 *   bun run posts-history.ts add --content "포스트 내용" --url "https://..."
 *   bun run posts-history.ts list
 *   bun run posts-history.ts get --id "uuid"
 */

import { parseArgs } from "util";
import { randomUUID } from "crypto";

const HISTORY_PATH = "/Users/xavier/code/LinkedIn/data/posts-history.json";

// 타입 정의
interface PostAnalytics {
  last_updated: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  engagement_rate: number;
}

interface Post {
  id: string;
  linkedin_url: string | null;
  published_at: string;
  content: string;
  format_type: "how-to" | "tips" | "news" | "story";
  image_path: string | null;
  scheduled: boolean;
  scheduled_for?: string;
  analytics: PostAnalytics | null;
}

interface PostsHistory {
  version: string;
  last_updated: string;
  posts: Post[];
}

// 히스토리 파일 읽기
async function readHistory(): Promise<PostsHistory> {
  try {
    const file = Bun.file(HISTORY_PATH);
    if (await file.exists()) {
      return await file.json();
    }
  } catch (error) {
    console.error("히스토리 파일 읽기 실패:", error);
  }

  // 기본 구조 반환
  return {
    version: "1.0.0",
    last_updated: new Date().toISOString(),
    posts: []
  };
}

// 히스토리 파일 저장
async function saveHistory(history: PostsHistory): Promise<void> {
  history.last_updated = new Date().toISOString();
  await Bun.write(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// 새 포스트 추가
async function addPost(options: {
  content: string;
  url?: string;
  formatType?: string;
  imagePath?: string;
  scheduled?: boolean;
  scheduledFor?: string;
}): Promise<Post> {
  const history = await readHistory();

  const newPost: Post = {
    id: randomUUID(),
    linkedin_url: options.url || null,
    published_at: new Date().toISOString(),
    content: options.content,
    format_type: (options.formatType as Post["format_type"]) || "tips",
    image_path: options.imagePath || null,
    scheduled: options.scheduled || false,
    analytics: null
  };

  if (options.scheduledFor) {
    newPost.scheduled_for = options.scheduledFor;
  }

  history.posts.unshift(newPost); // 최신 포스트를 앞에 추가
  await saveHistory(history);

  return newPost;
}

// 포스트 URL 업데이트 (발행 후)
async function updatePostUrl(postId: string, url: string): Promise<boolean> {
  const history = await readHistory();
  const post = history.posts.find(p => p.id === postId);

  if (!post) {
    console.error("포스트를 찾을 수 없습니다:", postId);
    return false;
  }

  post.linkedin_url = url;
  post.published_at = new Date().toISOString();
  await saveHistory(history);

  return true;
}

// 포스트 분석 데이터 업데이트
async function updateAnalytics(postId: string, analytics: Partial<PostAnalytics>): Promise<boolean> {
  const history = await readHistory();
  const post = history.posts.find(p => p.id === postId);

  if (!post) {
    console.error("포스트를 찾을 수 없습니다:", postId);
    return false;
  }

  post.analytics = {
    last_updated: new Date().toISOString(),
    impressions: analytics.impressions || 0,
    reactions: analytics.reactions || 0,
    comments: analytics.comments || 0,
    reposts: analytics.reposts || 0,
    engagement_rate: analytics.engagement_rate || 0
  };

  await saveHistory(history);
  return true;
}

// 포스트 목록 조회
async function listPosts(limit: number = 10): Promise<Post[]> {
  const history = await readHistory();
  return history.posts.slice(0, limit);
}

// 특정 포스트 조회
async function getPost(postId: string): Promise<Post | null> {
  const history = await readHistory();
  return history.posts.find(p => p.id === postId) || null;
}

// 포스트 상태 라벨 반환
function getPostStatusLabel(post: Post): string {
  if (post.scheduled) return "예약";
  if (post.linkedin_url) return "발행됨";
  return "초안";
}

// 통계 요약
async function getStats(): Promise<{
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  postsWithAnalytics: number;
  avgEngagementRate: number;
}> {
  const history = await readHistory();
  const posts = history.posts;

  const publishedPosts = posts.filter(p => p.linkedin_url && !p.scheduled);
  const scheduledPosts = posts.filter(p => p.scheduled);
  const postsWithAnalytics = posts.filter(p => p.analytics !== null);

  const totalEngagement = postsWithAnalytics.reduce(
    (sum, p) => sum + (p.analytics?.engagement_rate || 0),
    0
  );

  return {
    totalPosts: posts.length,
    publishedPosts: publishedPosts.length,
    scheduledPosts: scheduledPosts.length,
    postsWithAnalytics: postsWithAnalytics.length,
    avgEngagementRate: postsWithAnalytics.length > 0
      ? totalEngagement / postsWithAnalytics.length
      : 0
  };
}

// CLI 실행
async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      content: { type: "string" },
      url: { type: "string" },
      id: { type: "string" },
      format: { type: "string" },
      image: { type: "string" },
      limit: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  const command = positionals[0];

  if (values.help || !command) {
    console.log(`
LinkedIn 포스트 히스토리 관리

사용법:
  bun run posts-history.ts <command> [options]

명령어:
  add       새 포스트 추가
  list      포스트 목록 조회
  get       특정 포스트 조회
  stats     통계 요약
  update-url  포스트 URL 업데이트

옵션:
  --content   포스트 내용 (add 시 필수)
  --url       LinkedIn 포스트 URL
  --id        포스트 ID (get, update-url 시 필수)
  --format    포맷 타입 (how-to, tips, news, story)
  --image     이미지 경로
  --limit     목록 조회 개수 (기본: 10)
  -h, --help  도움말 표시

예시:
  bun run posts-history.ts add --content "새 포스트 내용" --format "how-to"
  bun run posts-history.ts list --limit 5
  bun run posts-history.ts get --id "uuid-here"
  bun run posts-history.ts update-url --id "uuid" --url "https://linkedin.com/posts/..."
    `);
    return;
  }

  switch (command) {
    case "add": {
      if (!values.content) {
        console.error("오류: --content 옵션이 필요합니다");
        process.exit(1);
      }

      const post = await addPost({
        content: values.content,
        url: values.url,
        formatType: values.format,
        imagePath: values.image
      });

      console.log("포스트 추가됨:");
      console.log(JSON.stringify(post, null, 2));
      break;
    }

    case "list": {
      const limit = parseInt(values.limit || "10");
      const posts = await listPosts(limit);

      console.log(`최근 ${posts.length}개 포스트:`);
      posts.forEach((post, index) => {
        const date = new Date(post.published_at).toLocaleString("ko-KR");
        const status = getPostStatusLabel(post);
        console.log(`${index + 1}. [${status}] ${date}`);
        console.log(`   ID: ${post.id}`);
        console.log(`   내용: ${post.content.substring(0, 50)}...`);
        if (post.linkedin_url) {
          console.log(`   URL: ${post.linkedin_url}`);
        }
        console.log();
      });
      break;
    }

    case "get": {
      if (!values.id) {
        console.error("오류: --id 옵션이 필요합니다");
        process.exit(1);
      }

      const post = await getPost(values.id);
      if (post) {
        console.log(JSON.stringify(post, null, 2));
      } else {
        console.error("포스트를 찾을 수 없습니다:", values.id);
      }
      break;
    }

    case "update-url": {
      if (!values.id || !values.url) {
        console.error("오류: --id와 --url 옵션이 모두 필요합니다");
        process.exit(1);
      }

      const success = await updatePostUrl(values.id, values.url);
      if (success) {
        console.log("포스트 URL 업데이트 완료");
      }
      break;
    }

    case "stats": {
      const stats = await getStats();
      console.log("포스트 통계:");
      console.log(`  총 포스트: ${stats.totalPosts}개`);
      console.log(`  발행됨: ${stats.publishedPosts}개`);
      console.log(`  예약됨: ${stats.scheduledPosts}개`);
      console.log(`  분석 데이터 있음: ${stats.postsWithAnalytics}개`);
      console.log(`  평균 인게이지먼트: ${(stats.avgEngagementRate * 100).toFixed(2)}%`);
      break;
    }

    default:
      console.error("알 수 없는 명령어:", command);
      process.exit(1);
  }
}

// 모듈 내보내기 (다른 스크립트에서 사용 가능)
export {
  readHistory,
  saveHistory,
  addPost,
  updatePostUrl,
  updateAnalytics,
  listPosts,
  getPost,
  getStats,
  getPostStatusLabel,
  Post,
  PostAnalytics,
  PostsHistory
};

// CLI 실행
main().catch(console.error);
