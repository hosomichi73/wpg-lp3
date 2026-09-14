"""ローカル動作確認用サーバー（Vercel の挙動を簡易的に再現します）

使い方（このフォルダの1つ上＝LPのフォルダで実行）:
    python3 tools/dev_server.py
    → ブラウザで http://localhost:8000 を開く

- /thanks, /privacy のような拡張子なしURLを thanks.html, privacy.html として返します（vercel.json の cleanUrls と同じ）
- POST /api/contact は実際にはメールを送らず、成功（200）を返します
- 送信失敗の表示を確認したいときは http://localhost:8000/?fail=1 を開いて送信してください（502を返します）

本番のメール送信（Resend）は Vercel 上でのみ動作します。
"""
import http.server
import json
import os
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8000'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path not in ('', '/') and '.' not in os.path.basename(path):
            if os.path.isfile(os.path.join(ROOT, path.lstrip('/') + '.html')):
                self.path = path + '.html'
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != '/api/contact':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(length).decode('utf-8', 'replace')
        fail = 'fail=1' in self.headers.get('Referer', '')
        print('[dev] /api/contact', 'FAIL (simulated)' if fail else 'OK', payload)
        body = json.dumps({'error': 'simulated failure'} if fail else {'ok': True}).encode()
        self.send_response(502 if fail else 200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    print(f'Serving {ROOT} at http://localhost:{PORT}  (Ctrl+C で停止)')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
