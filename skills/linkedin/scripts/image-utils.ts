/**
 * LinkedIn 포스트 이미지 관리 유틸리티
 *
 * 이미지 저장 및 관리를 위한 함수들을 제공합니다.
 * 네이밍 규칙: YYYYMMDD_NNN.ext (예: 20250114_001.png)
 */

import { existsSync, readdirSync, mkdirSync } from "fs";
import { join, extname } from "path";

// 이미지 저장 기본 경로
export const IMAGES_BASE_PATH = "/Users/xavier/code/LinkedIn/images";

// 지원하는 이미지 형식
export const SUPPORTED_FORMATS = ["png", "jpg", "jpeg", "gif", "webp"] as const;
export type SupportedFormat = typeof SUPPORTED_FORMATS[number];

/**
 * 날짜를 YYYYMMDD 형식의 문자열로 변환
 * @param date - 변환할 날짜
 * @returns YYYYMMDD 형식의 문자열
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 이미지 형식이 유효한지 검증
 * @param filename - 검증할 파일명 또는 확장자
 * @returns 유효한 형식이면 true, 아니면 false
 */
export function isValidImageFormat(filename: string): boolean {
  // 확장자 추출 (점이 있으면 확장자만, 없으면 전체를 확장자로 간주)
  const ext = filename.includes(".")
    ? extname(filename).slice(1).toLowerCase()
    : filename.toLowerCase();

  return SUPPORTED_FORMATS.includes(ext as SupportedFormat);
}

/**
 * 이미지 파일의 전체 경로 반환
 * @param filename - 이미지 파일명
 * @returns 전체 경로
 */
export function getImagePath(filename: string): string {
  return join(IMAGES_BASE_PATH, filename);
}

/**
 * 해당 날짜의 마지막 이미지 순번 조회
 * @param date - 조회할 날짜
 * @returns 마지막 순번 (파일이 없으면 0)
 */
export function getLastSequenceNumber(date: Date): number {
  const dateStr = formatDateString(date);

  // 이미지 디렉토리가 없으면 0 반환
  if (!existsSync(IMAGES_BASE_PATH)) {
    return 0;
  }

  try {
    const files = readdirSync(IMAGES_BASE_PATH);

    // 해당 날짜로 시작하는 파일들 필터링
    const datePattern = new RegExp(`^${dateStr}_(\\d{3})\\.(${SUPPORTED_FORMATS.join("|")})$`, "i");

    let maxSequence = 0;

    for (const file of files) {
      const match = file.match(datePattern);
      if (match) {
        const sequence = parseInt(match[1], 10);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }

    return maxSequence;
  } catch (error) {
    console.error("Error reading images directory:", error);
    return 0;
  }
}

/**
 * 새 이미지 파일명 생성 (해당 날짜의 다음 순번)
 * @param date - 이미지 날짜
 * @param extension - 파일 확장자 (점 없이, 예: "png")
 * @returns 생성된 파일명 (예: "20250114_001.png")
 * @throws 유효하지 않은 확장자일 경우 에러
 */
export function generateImageFilename(date: Date, extension: string): string {
  // 확장자 정규화 (점 제거, 소문자 변환)
  const normalizedExt = extension.replace(/^\./, "").toLowerCase();

  // 확장자 유효성 검사
  if (!isValidImageFormat(normalizedExt)) {
    throw new Error(
      `Invalid image format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(", ")}`
    );
  }

  const dateStr = formatDateString(date);
  const lastSequence = getLastSequenceNumber(date);
  const nextSequence = String(lastSequence + 1).padStart(3, "0");

  return `${dateStr}_${nextSequence}.${normalizedExt}`;
}

/**
 * 이미지 저장 디렉토리 확인 및 생성
 * @returns 디렉토리 경로
 */
export function ensureImagesDirectory(): string {
  if (!existsSync(IMAGES_BASE_PATH)) {
    mkdirSync(IMAGES_BASE_PATH, { recursive: true });
    console.log(`Created images directory: ${IMAGES_BASE_PATH}`);
  }
  return IMAGES_BASE_PATH;
}

/**
 * 파일명에서 날짜와 순번 파싱
 * @param filename - 파싱할 파일명
 * @returns 날짜와 순번 객체, 파싱 실패시 null
 */
export function parseImageFilename(filename: string): { date: Date; sequence: number; extension: string } | null {
  const pattern = /^(\d{4})(\d{2})(\d{2})_(\d{3})\.(\w+)$/;
  const match = filename.match(pattern);

  if (!match) {
    return null;
  }

  const [, year, month, day, sequence, extension] = match;

  return {
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    sequence: parseInt(sequence, 10),
    extension: extension.toLowerCase(),
  };
}

/**
 * 특정 날짜의 모든 이미지 파일 목록 조회
 * @param date - 조회할 날짜
 * @returns 이미지 파일명 배열
 */
export function getImagesByDate(date: Date): string[] {
  const dateStr = formatDateString(date);

  if (!existsSync(IMAGES_BASE_PATH)) {
    return [];
  }

  try {
    const files = readdirSync(IMAGES_BASE_PATH);
    const datePattern = new RegExp(`^${dateStr}_\\d{3}\\.(${SUPPORTED_FORMATS.join("|")})$`, "i");

    return files
      .filter(file => datePattern.test(file))
      .sort();
  } catch (error) {
    console.error("Error reading images directory:", error);
    return [];
  }
}

// CLI 테스트 지원
if (import.meta.main) {
  console.log("=== Image Utils Test ===\n");

  // 디렉토리 확인
  ensureImagesDirectory();
  console.log(`Images base path: ${IMAGES_BASE_PATH}\n`);

  // 오늘 날짜로 테스트
  const today = new Date();
  console.log(`Today: ${formatDateString(today)}`);

  // 형식 검증 테스트
  console.log("\n--- Format Validation ---");
  const testFormats = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "test.png", "image.JPG"];
  for (const format of testFormats) {
    console.log(`${format}: ${isValidImageFormat(format) ? "valid" : "invalid"}`);
  }

  // 순번 조회 테스트
  console.log("\n--- Sequence Number ---");
  const lastSeq = getLastSequenceNumber(today);
  console.log(`Last sequence for today: ${lastSeq}`);

  // 파일명 생성 테스트
  console.log("\n--- Generate Filename ---");
  try {
    const newFilename = generateImageFilename(today, "png");
    console.log(`New filename: ${newFilename}`);
    console.log(`Full path: ${getImagePath(newFilename)}`);
  } catch (error) {
    console.error("Error generating filename:", error);
  }

  // 오늘 이미지 목록
  console.log("\n--- Today's Images ---");
  const todayImages = getImagesByDate(today);
  if (todayImages.length === 0) {
    console.log("No images for today");
  } else {
    todayImages.forEach(img => console.log(`  - ${img}`));
  }
}
