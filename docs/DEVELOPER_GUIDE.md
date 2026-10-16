# 개발자 가이드 — 현재 코드 기준

## 1. 기술 구조

프런트엔드는 HTML/CSS/일반 JavaScript다. 외부 런타임 라이브러리 없이 동작한다.
`src/index.html` 끝에서 여덟 개의 classic script를 순서대로 로드한다.
모든 파일은 브라우저 전역 렉시컬 환경을 공유한다. ES module로 분리한 구조가 아니다.
`state`, `$`, `icons` 등은 파일 간 공유되지만 `window.state` 속성이라고 가정하면 안 된다.
`main.js`가 마지막에 이벤트를 연결하고 IndexedDB를 연다.

이번에는 원본의 함수명·UI·저장 구조를 유지한 채 파일을 분리하고 들여쓰기를 정리했다.
사용자가 확인한 원본 파일은 `original`에 그대로 보관한다.

## 2. 수정 위치 찾기

| 하려는 수정 | 파일 / 함수·상수 |
| --- | --- |
| 화면 순서·버튼·문구 | `src/index.html` |
| 휴대폰 화면·표 스타일 | `src/css/styles.css` |
| 카메라/마이크 설정·녹음 시작 | `core.js / startSession()` |
| 한국어 음성인식·자유발화 위치 추출 | `speech.js / startSpeechRecognition(), parseVoiceInput()` |
| 사진 저장·위치 스냅샷 | `core.js / capture()` |
| 녹음 일시정지·종료 | `core.js / pauseSession(), finishSession()` |
| 위치 유지·변경 | `core.js / applyLocation(), locationRender()` 및 `main.js` |
| 저장소 스키마 | `core.js / openDB(), transaction()` |
| 음성 재생 | `core.js / sessionBlob(), openDetailBase()` |
| 분류 용어·예외 | `records.js / POSITION_RULES, TRADE_RULES, TYPE_RULES, automaticClassification()` |
| 수동 보정 우선순위 | `records.js / classifyRecord()` |
| 목록·필터·선택 | `records.js / visibleRecords(), selectedRecords(), renderListV2()` |
| 상세 수정 | `records.js / openDetail()` |
| 집계·최다 위치·반복 요약 | `analytics.js / renderAnalytics(), renderInsights()` |
| 체험 36건 | `analytics.js / makeDemoRows(), seedExamples()` |
| 엑셀 열·행·사진 크기 | `excel.js / makeExcel(), imageForExcel(), imageAnchor()` |
| 엑셀 집계 수식 | `excel.js / makeSummarySheet()` |
| 엑셀 기본 서식 | `xlsx-template.js / XLSX_TEMPLATE` |
| ZIP 백업 생성 | `core.js / exportRecords(), zipBlob()` |
| ZIP 복원·검증·중복 제거 | `backup-import.js / importBackup(), parseStoredZip()` |
| 전역 이벤트·초기화 | `main.js / wireV2()` 및 파일 하단 |

## 3. 데이터 저장 구조

DB 이름은 **`field-note-prototype-v1`**, IndexedDB 버전은 **1**이다.
화면 버전 v2와 DB 이름/버전이 다르다. 이름을 바꾸면 데이터가 새 저장소에 보이므로
자동 마이그레이션 없이 변경하지 않는다.

| Object store | 키/인덱스 | 내용 |
| --- | --- | --- |
| records | `id` | 촬영 이미지, 동호수, 설명, 분류 보정값 |
| sessions | `id` | 점검 세션, 녹음 형식, 상태·시각 |
| chunks | `id`; `sessionId` 인덱스 | MediaRecorder가 반환한 Blob 조각 |

`localStorage`에는 `field-note-` 접두어로 유지 설정, 모드별 마지막 위치 등을 저장한다.
설정과 실제 기록은 서로 다른 저장소에 있다. 기기 간 동기화는 없다.
참고용 타입은 `types/current-data-model.d.ts`에 있다. 런타임 검증을 추가한 것은 아니다.

### records 핵심 필드

| 필드 | 의미 |
| --- | --- |
| id / sessionId | 기록 ID / 점검 ID |
| number | 해당 세션 내 순번 |
| mode | `demo` 또는 `live` |
| createdAt | 촬영 시각, epoch 밀리초 |
| location | 촬영 당시 유지 중이던 동호수 원문 |
| text | 지적 내용. 담당 업체명이 함께 들어갈 수 있음 |
| photo / photoFormat | data URL / `svg`, `jpg`, `png`, `webp` |
| audioOffsetMs | 일시정지를 제외한 앱 타이머 기준 촬영 위치. 정확한 오디오 샘플 좌표가 아님 |
| transcriptionStatus | 현재 `demo`, `browser`, `pending`, `not_supported`, `manual` |
| cloudStatus | 현재 항상 `not_connected` |
| unitOverride | 사람이 보정한 동호수 |
| positionOverride / tradeOverride / typeOverride | 사람이 보정한 위치/공종/지적 유형 |
| note / classificationReviewed / updatedAt | 비고/수동 확인 여부/수정 시각 |
| demoSource | 집계용 예시 데이터 표지, 선택 항목 |

분류값은 원칙적으로 렌더링 때 `automaticClassification()`으로 계산한다.
사람의 `*Override` 값이 있으면 `classifyRecord()`에서 우선한다.
`location`을 세대 내 위치와 혼동하면 엑셀의 동호수/위치 열이 뒤섞인다.

### sessions / chunks 주의사항

실제 촬영 세션에는 `createdAt`, `endedAt`, `durationMs`, `locationAtStart` 등이 있다.
예시/가져오기 경로는 `startedAt`와 `finished` 상태를 사용하기도 한다.
즉 현재 스키마는 완전히 통일되지 않았다. 서버 저장을 붙이기 전에 버전 마이그레이션이 필요하다.

녹음 조각은 `{id, sessionId, seq, blob, receivedAt?}`로 보관한다.
가져온 녹음에는 `receivedAt`가 없을 수 있다.
단순히 1초 간격으로 요청한 조각이라고 해서 각 조각이 독립 재생 가능한 1초 파일은 아니다.
미디어 형식은 현재 WebM/Opus, MP4, WebM 순서로 지원 여부를 확인한다.

## 4. 실제 촬영 흐름

`startSession()`에서 카메라+마이크를 요청하고 화면에는 비디오 트랙을 표시한다.
녹음기는 오디오 트랙만 받는다. 점검 중 `MediaRecorder.start(1000)`으로 데이터를 받는다.
`capture()`는 화면 프레임을 JPEG로 만들고 녹음기를 끊지 않은 채 기록을 저장한다.
현재 실제 사진은 **최대 가로 1600px, JPEG 품질 인자 0.87**이다. 센서 원본 파일이 아니다.
높은 원본 해상도 보관이 필요하면 별도 정책/코드를 추가해야 한다.

촬영 타이머는 `performance.now()` 기반이며 일시정지 시간을 뺀다.
그러나 녹음기 시작 지연과 실제 미디어 타임라인의 일치까지 보장하지 않는다.
따라서 `audioOffsetMs`만으로 발화의 시작/끝을 정확히 자르지 않는다.
상세 재생의 ‘촬영 4초 전’ 탐색은 **원본 재생 편의 기능**이지 사진별 음성 분리 알고리즘이 아니다.

목록·집계·상세·위치 창으로 이동할 때 녹음을 일시정지한다.
다른 앱/탭으로 이동하는 live 모드에서도 일시정지한다. 화면이 꺼진 상태의 연속 점검 앱은 아니다.
화면 잠금 방지 요청은 best-effort이며 실패를 무시하는 현재 코드다.

## 5. 분류·집계

위치/공종/유형은 정규식 규칙이며 음성인식이나 사진 AI가 아니다.
여러 후보가 충돌하면 일부 예외를 제외하고 `미분류`로 남긴다.
업체명에 포함된 공종 단어가 오분류를 유발할 수 있으므로 현장 예시로 검증해야 한다.

분석은 기본 `live`만 대상이며 체험을 선택해야 `demo`가 포함된다.
동일 위치×공종×유형 3건 이상인 조합을 최대 3개 보여주는 것은 빈도 요약이다.
동일 하자 중복 사진을 제거하지 않는다. ‘등록된 세대 수’는 전체 점검 세대 수가 아니다.
날짜별 그래프는 조회 결과의 끝 날짜를 기준으로 최근 7개 날짜를 표시한다.
장기 기간 전체 그래프나 하자율 분석으로 오인하지 않는다.

## 6. 엑셀 구현

`XLSX_TEMPLATE`에 기존 OOXML 서식 문자열과 스타일 인덱스가 들어 있다.
엑셀 JS 라이브러리를 CDN에서 로드하지 않으며 XML·이미지를 로컬에서 ZIP으로 묶는다.
템플릿의 스타일 인덱스를 바꾸면 `makeExcel()`의 셀 매핑도 검증해야 한다.

등록목록의 4행은 헤더, 5행부터 기록이며 사진은 G열 대응 행에 이미지 개체로 삽입한다.
날짜는 한국시간 날짜 기준 숫자 셀이고 데이터는 촬영시간 오름차순으로 내보낸다.
내보내기용 사진은 별도 축소한다. 원래 브라우저 저장본과 크기가 다를 수 있다.
엑셀에는 녹음 원본을 넣지 않는다. 녹음은 ZIP 백업으로 보관한다.

현재 코드는 1회 내보내기를 1,000건으로 제한한다. 이는 처리 성능 보장치가 아니다.
사진 크기·휴대폰 메모리에 따라 훨씬 적은 건수에서도 별도 분할이 필요할 수 있다.
집계의 COUNTIF/COUNTA는 수식과 캐시값을 기록한다. 범주 행은 내보내기 시점 기준이다.
엑셀에서 새 범주를 추가하는 경우 앱에서 다시 출력하거나 집계 범주도 추가해야 한다.
셀 내용은 inline string으로 직렬화하므로 설명을 수식 문자열로 직접 쓰지 않는다.

## 7. 백업과 가져오기

백업 ZIP에는 `records.json`, `photos/`, `audio/`가 들어 있다.
`schemaVersion` 1 또는 2를 받아들이고, 같은 ID는 덮어쓰지 않는 병합이다.
임의의 압축 방식을 모두 지원하지 않는다. 자체 ZIP writer의 store(무압축) 형식 기준이다.
순수 JSON은 이미지 data URL을 포함한 지원 구조일 때만 가능하다.
ZIP에서 추출한 `records.json`만 가져오면 사진이 없어 실패할 수 있다.

이 코드 전달 ZIP 자체는 업무 기록 복원 ZIP이 아니다.
사용자의 원래 브라우저 데이터는 기존 앱의 기록 백업으로 별도 전달해야 한다.

## 8. 운영 전 알려진 제약

- 단일 브라우저 저장소: 서버, 로그인, 사이트/현장 엔터티, 사용자/업체 권한 없음.
- 데이터 보관은 브라우저 저장소에 의존. 저장소 삭제/기기 변경을 대비한 운영 정책 없음.
- 모든 기록·이미지를 메모리에 불러오는 구조라 대용량·장시간 성능은 미검증.
- 오류 표시와 일부 저장 실패 대응은 있으나 사진-녹음 원자적 저장/업로드 큐는 미구현.
- 세션 시간·상태 스키마의 경로별 차이 존재. 추가 스키마 설계 필요.
- 브라우저 STT와 위치 추출은 구현됨. 샘플 단위 정밀 음성 분리·업체 자동 배분은 없음.
- 현재 사진 삭제는 해당 사진 기록만 지움. 해당 세션 음성은 유지됨.
- 오프라인 PWA, 서비스워커, 자동 재전송, 인증, 보존기간 자동 삭제, 감사 기록 없음.
- AI 예측 문구는 UI 예시. 운영 판단이나 품질 순위에 사용하지 않음.
- 표/이미지 렌더링, 파일 가져오기, 접근권한에 대한 별도 보안 리뷰 필요.

API 키를 클라이언트 파일에 넣는 방법으로 기능을 붙이지 않는다.
실제 서버를 연결할 때에는 업무 사진·음성의 전송 범위를 사용자에게 표시하고,
보관기간·접근권한·삭제 정책을 함께 설계해야 한다.
