#!/usr/bin/env bun
/**
 * LinkedIn Export Parser
 *
 * LinkedIn에서 내보낸 데이터 파일(CSV/HTML)을 파싱하여 구조화된 JSON으로 변환합니다.
 *
 * 사용법:
 *   bun run parse-linkedin-export.ts --input <파일경로> [--output <출력경로>] [--format <csv|html|auto>]
 *
 * 예시:
 *   bun run parse-linkedin-export.ts --input ~/Downloads/Shares.csv --output ./posts.json
 *   bun run parse-linkedin-export.ts -i export.html -o posts.json -f html
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname, basename } from "path";

// ============================================================================
// Types
// ============================================================================

interface LinkedInPost {
  id: string;
  date: string;
  content: string;
  media: string[];
  engagement: {
    impressions?: number;
    reactions?: number;
    comments?: number;
    reposts?: number;
  };
  shareUrl?: string;
  visibility?: string;
}

interface ParsedOutput {
  metadata: {
    source_file: string;
    parsed_at: string;
    format: "csv" | "html";
    parser_version: string;
  };
  posts: LinkedInPost[];
  total_count: number;
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function parseDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === "") {
    return new Date().toISOString().split("T")[0];
  }

  // LinkedIn CSV 날짜 형식: "2025-01-14 09:30:00 UTC" 또는 "Jan 14, 2025"
  const cleanDate = dateStr.trim();

  // ISO 형식 시도
  const isoMatch = cleanDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // "Jan 14, 2025" 형식
  const monthMatch = cleanDate.match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthMatch) {
    const monthIndex = MONTH_NAMES.indexOf(monthMatch[1] as typeof MONTH_NAMES[number]);
    if (monthIndex !== -1) {
      const month = String(monthIndex + 1).padStart(2, "0");
      const day = monthMatch[2].padStart(2, "0");
      const year = monthMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  // "14 Jan 2025" 형식
  const altMatch = cleanDate.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (altMatch) {
    const monthIndex = MONTH_NAMES.indexOf(altMatch[2] as typeof MONTH_NAMES[number]);
    if (monthIndex !== -1) {
      const month = String(monthIndex + 1).padStart(2, "0");
      const day = altMatch[1].padStart(2, "0");
      const year = altMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  // 날짜를 파싱할 수 없으면 원본 반환 또는 오늘 날짜
  try {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch {
    // 파싱 실패
  }

  return new Date().toISOString().split("T")[0];
}

function cleanContent(content: string): string {
  return content
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\r\n/g, "\n")
    .trim();
}

function extractMediaUrls(content: string): string[] {
  const urls: string[] = [];

  // LinkedIn 미디어 URL 패턴
  const patterns = [
    /https?:\/\/media\.licdn\.com\/[^\s"'<>)]+/g,
    /https?:\/\/[^\s"'<>)]*\.(?:jpg|jpeg|png|gif|webp|mp4)/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  return [...new Set(urls)];
}

// ============================================================================
// CSV Parser
// ============================================================================

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
        } else if (char === ",") {
          // Field separator
          currentRow.push(currentField);
          currentField = "";
        } else {
          currentField += char;
        }
      }
    }

    if (inQuotes) {
      // Line continues (multiline field)
      currentField += "\n";
    } else {
      // End of row
      currentRow.push(currentField);
      if (currentRow.some(field => field.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    }
  }

  // Handle last row if no trailing newline
  if (currentRow.length > 0 || currentField !== "") {
    currentRow.push(currentField);
    if (currentRow.some(field => field.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseLinkedInCSV(content: string): LinkedInPost[] {
  const rows = parseCSV(content);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const posts: LinkedInPost[] = [];

  // LinkedIn Shares.csv 일반적인 컬럼들:
  // Date, ShareCommentary, ShareMediaCategory, SharedUrl, etc.
  const dateIdx = headers.findIndex(h =>
    h.includes("date") || h.includes("날짜") || h.includes("timestamp")
  );
  const contentIdx = headers.findIndex(h =>
    h.includes("sharecommentary") || h.includes("content") ||
    h.includes("text") || h.includes("commentary") || h.includes("내용")
  );
  const urlIdx = headers.findIndex(h =>
    h.includes("sharedurl") || h.includes("url") || h.includes("link")
  );
  const mediaIdx = headers.findIndex(h =>
    h.includes("mediaurl") || h.includes("media") || h.includes("image")
  );
  const visibilityIdx = headers.findIndex(h =>
    h.includes("visibility") || h.includes("공개")
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // 빈 행 건너뛰기
    if (row.every(cell => cell.trim() === "")) continue;

    const rawContent = contentIdx >= 0 ? row[contentIdx] || "" : "";
    const content = cleanContent(rawContent);

    // 내용이 없으면 건너뛰기
    if (!content) continue;

    const post: LinkedInPost = {
      id: generateId(),
      date: dateIdx >= 0 ? parseDate(row[dateIdx] || "") : parseDate(""),
      content,
      media: [],
      engagement: {},
    };

    // URL 추출
    if (urlIdx >= 0 && row[urlIdx]) {
      post.shareUrl = row[urlIdx].trim();
    }

    // 미디어 URL 추출
    if (mediaIdx >= 0 && row[mediaIdx]) {
      const mediaUrls = extractMediaUrls(row[mediaIdx]);
      post.media.push(...mediaUrls);
    }

    // 콘텐츠에서도 미디어 URL 추출
    const contentMediaUrls = extractMediaUrls(rawContent);
    post.media.push(...contentMediaUrls);
    post.media = [...new Set(post.media)];

    // 공개 범위
    if (visibilityIdx >= 0 && row[visibilityIdx]) {
      post.visibility = row[visibilityIdx].trim();
    }

    posts.push(post);
  }

  return posts;
}

// ============================================================================
// HTML Parser
// ============================================================================

function parseLinkedInHTML(content: string): LinkedInPost[] {
  const posts: LinkedInPost[] = [];

  // LinkedIn HTML 내보내기 형식에서 포스트 추출
  // 일반적인 패턴들을 시도

  // 패턴 1: <article> 태그 기반
  const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;
  while ((articleMatch = articlePattern.exec(content)) !== null) {
    const articleContent = articleMatch[1];
    const post = extractPostFromHTML(articleContent);
    if (post) posts.push(post);
  }

  // 패턴 2: <div class="share-..."> 기반
  if (posts.length === 0) {
    const sharePattern = /<div[^>]*class="[^"]*share[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let shareMatch;
    while ((shareMatch = sharePattern.exec(content)) !== null) {
      const shareContent = shareMatch[1];
      const post = extractPostFromHTML(shareContent);
      if (post) posts.push(post);
    }
  }

  // 패턴 3: LinkedIn 데이터 내보내기의 테이블 형식
  if (posts.length === 0) {
    const tablePattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isHeader = true;
    while ((rowMatch = tablePattern.exec(content)) !== null) {
      if (isHeader) {
        isHeader = false;
        continue;
      }
      const rowContent = rowMatch[1];
      const post = extractPostFromTableRow(rowContent);
      if (post) posts.push(post);
    }
  }

  // 패턴 4: 일반 텍스트 블록 기반 (최후의 수단)
  if (posts.length === 0) {
    const textBlocks = content.split(/(?:<hr[^>]*>|<br\s*\/?>\s*<br\s*\/?>)/i);
    for (const block of textBlocks) {
      const text = stripHTML(block).trim();
      if (text.length > 50) {
        posts.push({
          id: generateId(),
          date: parseDate(""),
          content: text,
          media: extractMediaUrls(block),
          engagement: {},
        });
      }
    }
  }

  return posts;
}

function extractPostFromHTML(html: string): LinkedInPost | null {
  const text = stripHTML(html).trim();
  if (!text || text.length < 10) return null;

  // 날짜 추출 시도
  const datePatterns = [
    /<time[^>]*datetime="([^"]+)"[^>]*>/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\w{3}\s+\d{1,2},?\s+\d{4})/,
  ];

  let date = "";
  for (const pattern of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      date = parseDate(match[1]);
      break;
    }
  }

  // 이미지 URL 추출
  const imgPattern = /<img[^>]*src="([^"]+)"[^>]*>/gi;
  const media: string[] = [];
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    if (!imgMatch[1].includes("data:image")) {
      media.push(imgMatch[1]);
    }
  }

  // 추가 미디어 URL
  media.push(...extractMediaUrls(html));

  return {
    id: generateId(),
    date: date || parseDate(""),
    content: text,
    media: [...new Set(media)],
    engagement: {},
  };
}

function extractPostFromTableRow(html: string): LinkedInPost | null {
  const cells: string[] = [];
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch;
  while ((cellMatch = cellPattern.exec(html)) !== null) {
    cells.push(stripHTML(cellMatch[1]).trim());
  }

  if (cells.length < 2) return null;

  // 첫 번째 셀이 날짜, 두 번째 셀이 내용으로 가정
  const date = parseDate(cells[0] || "");
  const content = cells[1] || "";

  if (!content || content.length < 10) return null;

  return {
    id: generateId(),
    date,
    content,
    media: extractMediaUrls(html),
    engagement: {},
  };
}

function stripHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Main Logic
// ============================================================================

function detectFormat(filePath: string, content: string): "csv" | "html" {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".csv") return "csv";
  if (ext === ".html" || ext === ".htm") return "html";

  // 내용 기반 감지
  if (content.trim().startsWith("<!DOCTYPE") || content.includes("<html")) {
    return "html";
  }
  if (content.includes(",") && content.split("\n")[0].includes(",")) {
    return "csv";
  }

  // 기본값
  return "csv";
}

function parseLinkedInExport(
  filePath: string,
  format?: "csv" | "html" | "auto"
): ParsedOutput {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, "utf-8");
  const detectedFormat = format === "auto" || !format
    ? detectFormat(filePath, content)
    : format;

  let posts: LinkedInPost[];

  if (detectedFormat === "csv") {
    posts = parseLinkedInCSV(content);
  } else {
    posts = parseLinkedInHTML(content);
  }

  // 날짜순 정렬 (최신순)
  posts.sort((a, b) => b.date.localeCompare(a.date));

  return {
    metadata: {
      source_file: basename(absolutePath),
      parsed_at: new Date().toISOString(),
      format: detectedFormat,
      parser_version: "1.0.0",
    },
    posts,
    total_count: posts.length,
  };
}

// ============================================================================
// CLI
// ============================================================================

function printUsage(): void {
  console.log(`
LinkedIn Export Parser v1.0.0

사용법:
  bun run parse-linkedin-export.ts --input <파일경로> [옵션]

옵션:
  -i, --input <경로>    입력 파일 경로 (필수)
  -o, --output <경로>   출력 JSON 파일 경로 (기본: stdout)
  -f, --format <형식>   입력 형식: csv, html, auto (기본: auto)
  -p, --pretty          JSON 들여쓰기 (기본: 활성화)
  -h, --help            도움말 표시

예시:
  bun run parse-linkedin-export.ts -i ~/Downloads/Shares.csv -o posts.json
  bun run parse-linkedin-export.ts --input export.html --format html
  bun run parse-linkedin-export.ts -i data.csv | jq '.posts[0]'

지원 형식:
  - CSV: LinkedIn 데이터 내보내기의 Shares.csv 파일
  - HTML: LinkedIn 프로필에서 내보낸 HTML 파일
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      format: { type: "string", short: "f" },
      pretty: { type: "boolean", short: "p", default: true },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!values.input) {
    console.error("오류: 입력 파일이 지정되지 않았습니다.");
    console.error("사용법: bun run parse-linkedin-export.ts --input <파일경로>");
    console.error("도움말: bun run parse-linkedin-export.ts --help");
    process.exit(1);
  }

  try {
    const format = values.format as "csv" | "html" | "auto" | undefined;
    const result = parseLinkedInExport(values.input, format);

    const jsonOutput = values.pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    if (values.output) {
      const outputPath = resolve(values.output);
      writeFileSync(outputPath, jsonOutput, "utf-8");
      console.log(`파싱 완료: ${result.total_count}개의 포스트를 ${outputPath}에 저장했습니다.`);
    } else {
      console.log(jsonOutput);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`오류: ${message}`);
    process.exit(1);
  }
}

// Run
main();
