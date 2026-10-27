package com.hajaon.fieldnote;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_ORIGIN = "https://app.local";
    private static final int REQUEST_WEB_MEDIA = 10;
    private static final int REQUEST_SPEECH = 11;
    private static final int REQUEST_SAVE = 12;
    private static final int MAX_EXPORT_BYTES = 150 * 1024 * 1024;

    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private boolean pendingSpeechStart;
    private SpeechRecognizer speechRecognizer;
    private ByteArrayOutputStream exportBuffer;
    private int exportExpectedSize;
    private byte[] pendingSaveData;
    private String pendingSaveName;
    private String pendingSaveMime;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new LocalWebClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> requestWebPermission(request));
            }
        });
        webView.loadUrl(APP_ORIGIN + "/index.html");
    }

    private void requestWebPermission(PermissionRequest request) {
        if (!APP_ORIGIN.equals(request.getOrigin().toString().replaceAll("/$", ""))) {
            request.deny();
            return;
        }
        List<String> permissions = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                permissions.add(Manifest.permission.CAMERA);
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (permissions.isEmpty()) {
            request.grant(request.getResources());
            return;
        }
        pendingWebPermission = request;
        requestPermissions(permissions.toArray(new String[0]), REQUEST_WEB_MEDIA);
    }

    private void startSpeech() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingSpeechStart = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_SPEECH);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendJs("window.__nativeSpeechError('service-not-allowed');window.__nativeSpeechEnd();");
            return;
        }
        if (speechRecognizer != null)
            speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { sendJs("window.__nativeSpeechStart();"); }
            @Override public void onPartialResults(Bundle results) { sendSpeechResult(results, false); }
            @Override public void onResults(Bundle results) { sendSpeechResult(results, true); sendJs("window.__nativeSpeechEnd();"); }
            @Override public void onError(int error) { sendJs("window.__nativeSpeechError(" + JSONObject.quote(speechError(error)) + ");window.__nativeSpeechEnd();"); }
            @Override public void onBeginningOfSpeech() { }
            @Override public void onRmsChanged(float rmsdB) { }
            @Override public void onBufferReceived(byte[] buffer) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int eventType, Bundle params) { }
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        speechRecognizer.startListening(intent);
    }

    private void sendSpeechResult(Bundle bundle, boolean isFinal) {
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty())
            return;
        sendJs("window.__nativeSpeechResult(" + JSONObject.quote(matches.get(0)) + "," + isFinal + ");");
    }

    private String speechError(int error) {
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) return "not-allowed";
        if (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) return "network";
        return "no-speech";
    }

    private void sendJs(String script) {
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0;
        for (int result : grantResults)
            granted &= result == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQUEST_WEB_MEDIA && pendingWebPermission != null) {
            if (granted) pendingWebPermission.grant(pendingWebPermission.getResources()); else pendingWebPermission.deny();
            pendingWebPermission = null;
        } else if (requestCode == REQUEST_SPEECH && pendingSpeechStart) {
            pendingSpeechStart = false;
            if (granted) startSpeech(); else sendJs("window.__nativeSpeechError('not-allowed');window.__nativeSpeechEnd();");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_SAVE)
            return;
        if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveData != null) {
            try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                if (output == null) throw new FileNotFoundException();
                output.write(pendingSaveData);
                Toast.makeText(this, "파일을 저장했습니다.", Toast.LENGTH_SHORT).show();
            } catch (Exception error) {
                Toast.makeText(this, "파일 저장에 실패했습니다.", Toast.LENGTH_LONG).show();
            }
        }
        pendingSaveData = null;
        pendingSaveName = null;
        pendingSaveMime = null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        webView.destroy();
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface public void startSpeech() { runOnUiThread(MainActivity.this::startSpeech); }
        @JavascriptInterface public void stopSpeech() { runOnUiThread(() -> { if (speechRecognizer != null) speechRecognizer.stopListening(); }); }

        @JavascriptInterface
        public synchronized void beginSave(String name, String mime, int size) {
            if (size < 0 || size > MAX_EXPORT_BYTES) {
                exportBuffer = null;
                sendJs("toast('파일이 너무 커서 저장할 수 없습니다.', true);");
                return;
            }
            exportExpectedSize = size;
            exportBuffer = new ByteArrayOutputStream(Math.min(size, 4 * 1024 * 1024));
            pendingSaveName = name == null ? "현장노트_내보내기" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            pendingSaveMime = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;
        }

        @JavascriptInterface
        public synchronized void appendSaveChunk(String chunk) {
            if (exportBuffer == null || chunk == null || chunk.length() > 65536)
                return;
            byte[] decoded = Base64.decode(chunk, Base64.NO_WRAP);
            exportBuffer.write(decoded, 0, decoded.length);
        }

        @JavascriptInterface
        public synchronized void finishSave() {
            if (exportBuffer == null || exportBuffer.size() != exportExpectedSize) {
                exportBuffer = null;
                sendJs("toast('파일을 준비하지 못했습니다.', true);");
                return;
            }
            pendingSaveData = exportBuffer.toByteArray();
            exportBuffer = null;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(pendingSaveMime)
                    .putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                startActivityForResult(intent, REQUEST_SAVE);
            });
        }
    }

    private final class LocalWebClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("app.local".equals(uri.getHost()))
                return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (Exception ignored) { Toast.makeText(MainActivity.this, "링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show(); }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"app.local".equals(uri.getHost()))
                return null;
            String path = uri.getPath();
            String asset = path == null || path.equals("/") ? "index.html" : path.substring(1);
            if (!asset.equals("index.html") && !asset.equals("manifest.webmanifest"))
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
            try {
                String mime = asset.endsWith(".json") || asset.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, getAssets().open(asset));
            } catch (Exception error) {
                return null;
            }
        }
    }
}
