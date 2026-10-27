# 하자 ON 안드로이드 앱

기존 `dist/index.html`을 APK 안에 포함합니다. 기록은 앱의 WebView/IndexedDB에 저장되며 사진·ZIP·엑셀 내보내기는 Android 문서 선택기를 열어 Google Drive, OneDrive 또는 기기 폴더에 저장합니다.

## 빌드

JDK 17과 Android SDK 35가 준비된 환경에서:

```powershell
./gradlew.bat assembleDebug
```

결과: `app/build/outputs/apk/debug/app-debug.apk`

APK는 테스트용 디버그 서명입니다. Google Play 등록이나 자동 클라우드 동기화는 포함하지 않습니다.
