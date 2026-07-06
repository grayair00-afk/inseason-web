# 셀카모드 ("오늘의 나") — 진단 기록 및 재개 가이드

## 현재 상태
`index.html`의 `SELFIE_ENABLED` 값을 `false`로 설정해 **비활성화(숨김)** 처리함.
코드는 전혀 삭제하지 않았음 — `SELFIE_ENABLED = true`로 바꾸면 그대로 다시 켜짐.

```js
var SELFIE_ENABLED = false;  // <script> 블록, SelfieModule 바로 위
```

## 기능 개요
- 카메라로 실시간 촬영 → MediaPipe Selfie Segmentation으로 사람만 분리 →
  `content/backgrounds/`의 이미지로 가상배경 합성 → 폴라로이드 프레임 촬영 → 저장/다시찍기
- 관련 코드: `index.html` 내 `.selfie-*` CSS, `<section id="today">` HTML,
  `SelfieModule` IIFE(파일 하단 `<script>` 블록)
- 디버그 도구: URL에 `?selfiedebug=1`을 붙이면 화면 하단에 콘솔 로그가 그대로 표시됨
  (F12 없이 모바일에서도 확인 가능)

## 확인된 사실 (검증 완료)
| 항목 | PC(Chrome) | 안드로이드(Chrome) |
|---|---|---|
| `content/backgrounds/manifest.json` 로드 + 9개 이미지 전부 로드 성공 | ✅ | ✅ |
| MediaPipe 스크립트 로드(`typeof SelfieSegmentation !== 'undefined'`) | ✅ | ✅ |
| 카메라(`getUserMedia`) 실제로 켜짐 | ❌ | ✅ |
| 배경 합성(크로마키) 실제로 화면에 반영됨 | 확인 불가(카메라 자체가 안 켜짐) | ❌ (배경 바꾸기 눌러도 무반응, 계속 실사 배경) |

## 문제 1 — PC에서 카메라 자체가 안 켜짐 (원인 규명 완료, 코드 문제 아님)
- 증상: `AbortError: Timeout starting video source` — facingMode 지정 시도, 기본 설정 재시도
  둘 다 정확히 10초 후 동일하게 타임아웃.
- 원인: 이 PC는 **Windows 설정 → 개인정보 및 보안 → 카메라 → "데스크톱 앱이 카메라에
  액세스하도록 허용"이 의도적으로 꺼져 있음** (해킹 방지 목적). Windows 카메라 앱(UWP)은
  별도 권한 체계라 정상 작동하지만, 크롬 같은 데스크톱 앱은 이 토글에 막힘.
- 결론: **실제 방문자에게는 영향 없는 문제.** 대부분의 방문자 PC는 이 토글이 기본값(허용)이라
  정상 작동함. 개발자 본인 PC에서 직접 눈으로 확인하려면 이 설정을 테스트 중에만 켰다가
  다시 꺼두면 됨.
- 코드에도 이미 방어 처리 반영됨: `AbortError`도 재시도 대상에 포함, 에러 메시지에
  실제 에러명 표시, 카메라 장치 개수 로그(`enumerateDevices`) 추가.

## 문제 2 — 안드로이드에서 배경 합성이 시작되지 않음 (미해결, 다음에 이어서 진단)
- 증상: 카메라는 켜지고 배경 이미지도 다 로드되는데, "배경 바꾸기" 버튼을 눌러도 실사 배경만
  나옴. 콘솔에 에러 로그가 찍히지 않음(조용한 실패).
- 배경 합성이 켜지는 조건은 `drawLiveFrame()`의 `segReady && latestMask && bgReady` 세 가지
  전부 true일 때뿐. `bgReady`는 이미 검증 완료(true). 남은 용의선은 `segReady`(세그먼터
  초기화 자체는 try/catch로 성공 처리됨) 또는 `latestMask`(MediaPipe가 실제로 프레임 처리
  결과를 콜백으로 준 적이 있는지)가 계속 비어있는 경우.
- **가장 유력한 가설**: `segmenter.send({image: video})`가 응답 없이 멈춰있을 가능성.
  MediaPipe는 최초 `send()` 호출 시 WASM/모델 파일을 백그라운드에서 내려받는데, 이게 느리거나
  실패하면 Promise가 **resolve도 reject도 안 하고 그냥 멈출 수 있음** — 에러가 안 나는 이유가
  이거일 가능성이 높음. 그리고 현재 코드의 `segBusy` 가드(중복 처리 방지용으로 이번에 추가함)는
  이 경우 `segBusy = true`인 채로 영원히 풀리지 않아서, 이후 모든 프레임의 `send()` 호출 자체가
  스킵되는 **영구 잠김** 상태가 될 수 있음. (`index.html` 내 `drawLiveFrame()` 함수 참고)
- 다음에 이어서 확인할 것:
  1. `?selfiedebug=1`로 접속한 상태에서 스마트폰 브라우저의 개발자도구(또는 PC에 USB 연결 후
     `chrome://inspect`)로 **Network 탭**을 열어, `cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/`
     경로의 `.wasm`/모델 파일들이 실제로 다운로드 완료되는지 확인
  2. `segmenter.send()`에 타임아웃을 걸어서 (예: 3~4초 내 응답 없으면 `segBusy`를 강제로
     풀어주는 로직 추가) 영구 잠김 가설을 검증
  3. MediaPipe CDN 의존 대신 모델 파일을 프로젝트에 직접 포함(self-host)해서 CDN 네트워크
     상태와 무관하게 만드는 방법도 고려 가능
  4. 다른 안드로이드 기기/크롬 버전에서도 동일하게 재현되는지 교차 확인

## 재개 방법
1. `index.html`에서 `SELFIE_ENABLED = true`로 변경
2. 위 "다음에 이어서 확인할 것" 순서대로 진행
3. 문제 2가 해결되면 이 파일은 삭제하거나 "해결됨"으로 갱신
