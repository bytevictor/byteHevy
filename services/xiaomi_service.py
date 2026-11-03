#!/usr/bin/env python3
import os
import sys
import time
import json
import struct
import base64
import hashlib
import argparse
from datetime import datetime, timezone
import requests

USER_AGENT = "iqmevrwsojypkevwmr-DACACBDADADCC APP/com.xiaomi.mihome APPV/10.5.201"
PASSPORT_USER_AGENT = "APP/com.xiaomi.mihome APPV/10.5.201"


def gen_nonce() -> str:
    minutes = int(time.time() / 60)
    nonce_bytes = os.urandom(8) + struct.pack(">I", minutes)
    return base64.b64encode(nonce_bytes).decode("ascii")


def gen_signed_nonce(ssecurity_b64: str, nonce_b64: str) -> bytes:
    return hashlib.sha256(base64.b64decode(ssecurity_b64) + base64.b64decode(nonce_b64)).digest()


def rc4_crypt(key: bytes, data: bytes) -> bytes:
    S = list(range(256))
    j = 0
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) & 0xFF
        S[i], S[j] = S[j], S[i]
    i = j = 0
    for _ in range(1024):  # RC4-drop1024 requerido por Xiaomi
        i = (i + 1) & 0xFF
        j = (j + S[i]) & 0xFF
        S[i], S[j] = S[j], S[i]
    out = bytearray(len(data))
    for k in range(len(data)):
        i = (i + 1) & 0xFF
        j = (j + S[i]) & 0xFF
        S[i], S[j] = S[j], S[i]
        out[k] = data[k] ^ S[(S[i] + S[j]) & 0xFF]
    return bytes(out)


def gen_signature(method: str, path: str, params: dict, signed_nonce_bytes: bytes) -> str:
    snonce_b64 = base64.b64encode(signed_nonce_bytes).decode("ascii")
    sb = f"{method}&{path}"
    if "data" in params and params["data"]:
        sb += f"&data={params['data']}"
    if "rc4_hash__" in params and params["rc4_hash__"]:
        sb += f"&rc4_hash__={params['rc4_hash__']}"
    sb += f"&{snonce_b64}"
    return base64.b64encode(hashlib.sha1(sb.encode("utf-8")).digest()).decode("ascii")


class XiaomiAuthManager:
    """Gestiona el flujo de login interactivo mediante código QR."""
    def __init__(self):
        self.session = requests.Session()
        self.lp_url = None

    def start_qr_login(self) -> dict:
        dc = int(time.time() * 1000)
        url = (
            f"https://account.xiaomi.com/longPolling/loginUrl"
            f"?_qrsize=480&qs=%3Fsid%3Dxiaomiio%26_json%3Dtrue"
            f"&callback=https%3A%2F%2Fsts.api.io.mi.com%2Fsts"
            f"&_hasLogo=false&sid=xiaomiio&serviceParam=&_locale=es_ES&_dc={dc}"
        )
        res = self.session.get(url, headers={"User-Agent": PASSPORT_USER_AGENT}, timeout=15)
        text = res.text[len("&&&START&&&"):] if res.text.startswith("&&&START&&&") else res.text
        data = json.loads(text)
        self.lp_url = data.get("lp")
        return {
            "login_url": data.get("loginUrl"),
            "qr_image_url": data.get("qr"),
            "lp_url": self.lp_url
        }

    def check_qr_confirmation(self) -> dict | None:
        if not self.lp_url:
            return None
        try:
            res = self.session.get(self.lp_url, headers={"User-Agent": PASSPORT_USER_AGENT}, timeout=8)
            text = res.text[len("&&&START&&&"):] if res.text.startswith("&&&START&&&") else res.text
            data = json.loads(text)
            if "userId" in data and "passToken" in data:
                return {
                    "user_id": str(data["userId"]),
                    "pass_token": str(data["passToken"])
                }
        except Exception:
            pass
        return None


class XiaomiScaleClient:
    """Cliente desatendido para descarga incremental de datos."""
    def __init__(self, user_id: str, pass_token: str, region: str = "de", model: str = "yunmai.scales.ms104"):
        self.user_id = str(user_id).strip()
        self.pass_token = pass_token.strip()
        self.region = region.lower().strip()
        self.model = model.strip()
        self.session = requests.Session()
        self.ssecurity = None
        self.service_token = None

    def login_with_pass_token(self):
        url = "https://account.xiaomi.com/pass/serviceLogin?_json=true&sid=xiaomiio"
        headers = {
            "User-Agent": PASSPORT_USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": f"userId={self.user_id}; passToken={self.pass_token}"
        }
        res = self.session.get(url, headers=headers, timeout=15)
        text = res.text[len("&&&START&&&"):] if res.text.startswith("&&&START&&&") else res.text
        data = json.loads(text)
        
        if data.get("code") != 0 or data.get("result") != "ok":
            raise PermissionError(f"Sesión caducada o token inválido en Xiaomi (code={data.get('code')})")
        
        self.ssecurity = data.get("ssecurity")
        location = data.get("location")
        if not location:
            raise PermissionError("No se recibió la URL de redirección de sts de Xiaomi.")
            
        res_loc = self.session.get(location, timeout=15, allow_redirects=False)
        self.service_token = res_loc.cookies.get("serviceToken")
        if not self.service_token and "Set-Cookie" in res_loc.headers:
            for item in res_loc.headers.get("Set-Cookie", "").split(";"):
                if "serviceToken=" in item:
                    self.service_token = item.split("serviceToken=")[1].strip()
                    break

        if not self.service_token:
            raise PermissionError("No se pudo obtener el serviceToken. Es necesario re-autenticarse.")

    def request(self, path: str, data_json: str) -> dict:
        base_url = "https://api.io.mi.com/app" if self.region == "cn" else f"https://{self.region}.api.io.mi.com/app"
        url = base_url + path
        
        nonce = gen_nonce()
        signed_nonce = gen_signed_nonce(self.ssecurity, nonce)
        params = {"data": data_json}
        params["rc4_hash__"] = gen_signature("POST", path, params, signed_nonce)
        
        for k in list(params.keys()):
            val_bytes = params[k].encode("utf-8")
            enc_bytes = rc4_crypt(signed_nonce, val_bytes)
            params[k] = base64.b64encode(enc_bytes).decode("ascii")
        
        params["signature"] = gen_signature("POST", path, params, signed_nonce)
        params["_nonce"] = nonce
        
        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": f"userId={self.user_id}; serviceToken={self.service_token}"
        }
        if self.region != "cn":
            headers["MIOT-REQUEST-MODEL"] = self.model
        
        res = self.session.post(url, data=params, headers=headers, timeout=20)
        raw_b64 = res.text.strip()
        raw_bytes = base64.b64decode(raw_b64)
        dec_bytes = rc4_crypt(signed_nonce, raw_bytes)
        resp_json = json.loads(dec_bytes.decode("utf-8", errors="replace"))
        
        if resp_json.get("code") != 0:
            raise RuntimeError(f"Error API Xiaomi: {resp_json.get('message')}")
        
        return resp_json.get("result", {})

    def fetch_measurements(self, since_timestamp_ms: int = 0) -> list[dict]:
        if not self.service_token:
            self.login_with_pass_token()
            
        all_records = []
        begin_time_ms = int(time.time() * 1000)
        path = "/eco/scale/getData" if self.region == "cn" else "/eco/common/scale/getUserDataByPage"

        while begin_time_ms > 0:
            payload = json.dumps({
                "endTime": 1,
                "beginTime": begin_time_ms,
                "model": self.model,
                "uid": str(self.user_id),
                "did": 0,
                "accountId": 0
            })
            
            result = self.request(path, payload)
            items = result if isinstance(result, list) else (result.get("data") or result.get("list") or [])
            if not items:
                break
                
            reached_cutoff = False
            for item in items:
                record = self._parse_scale_item(item)
                if record:
                    if since_timestamp_ms and record["timestamp_ms"] <= since_timestamp_ms:
                        reached_cutoff = True
                        break
                    all_records.append(record)
            
            if reached_cutoff or len(items) < 20:
                break
                
            last_create_time = int(items[-1].get("createTime", 0))
            if last_create_time <= 0 or last_create_time >= begin_time_ms:
                break
            begin_time_ms = last_create_time
            time.sleep(0.2)

        return all_records

    def _parse_scale_item(self, item: dict) -> dict:
        create_time_ms = int(item.get("createTime", 0))
        create_time_sec = create_time_ms / 1000.0 if create_time_ms > 1e11 else create_time_ms
        raw_data = item.get("data", "")
        data_obj = json.loads(raw_data) if isinstance(raw_data, str) and raw_data else (raw_data or {})
        dt = datetime.fromtimestamp(create_time_sec, tz=timezone.utc).astimezone() if create_time_sec else None
        
        user_info = data_obj.get("user") or {}
        body_res = data_obj.get("bodyResData") or {}
        if isinstance(body_res, str):
            try: body_res = json.loads(body_res)
            except: body_res = {}

        def to_float(val):
            try: return round(float(val), 2) if val is not None else None
            except: return None

        def to_int(val):
            try: return int(float(val)) if val is not None else None
            except: return None

        return {
            "timestamp_ms": create_time_ms,
            "measured_at": dt.isoformat() if dt else None,
            "weight_kg": to_float(data_obj.get("weight")),
            "bmi": to_float(data_obj.get("bmi")),
            "body_fat_pct": to_float(data_obj.get("bfp") or body_res.get("bfp")),
            "body_water_pct": to_float(data_obj.get("bwp") or body_res.get("bwp")),
            "bone_mass_kg": to_float(data_obj.get("bmc") or body_res.get("bmc")),
            "muscle_mass_kg": to_float(data_obj.get("slm") or body_res.get("slm")),
            "protein_mass_kg": to_float(data_obj.get("pm") or data_obj.get("pp") or body_res.get("pm")),
            "skeletal_muscle_mass_kg": to_float(data_obj.get("smm") or body_res.get("smm")),
            "visceral_fat": to_int(data_obj.get("vfl") or body_res.get("vfl")),
            "metabolic_age": to_int(data_obj.get("ma") or body_res.get("ma")),
            "bmr_kcal": to_int(data_obj.get("bmr") or body_res.get("bmr")),
            "body_score": to_int(data_obj.get("sbc") or body_res.get("sbc")),
            "heart_rate_bpm": to_int(data_obj.get("heartRate")),
            "user_name": user_info.get("name", "Usuario"),
            "height_cm": to_float(user_info.get("height")),
            "scale_model": item.get("model", self.model)
        }


def main():
    parser = argparse.ArgumentParser(description="Xiaomi Cloud Scale Service")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcomando: start_qr
    subparsers.add_parser("start_qr", help="Iniciar login con código QR")

    # Subcomando: check_qr
    parser_check = subparsers.add_parser("check_qr", help="Comprobar aprobación del código QR")
    parser_check.add_argument("--lp-url", required=True, help="URL de long polling")

    # Subcomando: sync
    parser_sync = subparsers.add_parser("sync", help="Descargar pesajes incrementales")
    parser_sync.add_argument("--user-id", required=True, help="User ID de Xiaomi")
    parser_sync.add_argument("--pass-token", required=True, help="Pass Token de Xiaomi")
    parser_sync.add_argument("--region", default="de", help="Región del servidor (de, cn, us, etc.)")
    parser_sync.add_argument("--model", default="yunmai.scales.ms104", help="Modelo de la báscula")
    parser_sync.add_argument("--since", type=int, default=0, help="Timestamp en ms del último registro conocido")

    # Subcomando: test_auth
    parser_test = subparsers.add_parser("test_auth", help="Verificar validez del pass_token")
    parser_test.add_argument("--user-id", required=True)
    parser_test.add_argument("--pass-token", required=True)

    args = parser.parse_args()

    if args.command == "start_qr":
        try:
            auth_mgr = XiaomiAuthManager()
            qr_info = auth_mgr.start_qr_login()
            print(json.dumps({
                "success": True,
                "login_url": qr_info["login_url"],
                "qr_image_url": qr_info["qr_image_url"],
                "lp_url": qr_info["lp_url"]
            }))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)

    elif args.command == "check_qr":
        try:
            auth_mgr = XiaomiAuthManager()
            auth_mgr.lp_url = args.lp_url
            res = auth_mgr.check_qr_confirmation()
            if res:
                print(json.dumps({
                    "success": True,
                    "confirmed": True,
                    "user_id": res["user_id"],
                    "pass_token": res["pass_token"]
                }))
            else:
                print(json.dumps({
                    "success": True,
                    "confirmed": False
                }))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)

    elif args.command == "sync":
        try:
            client = XiaomiScaleClient(
                user_id=args.user_id,
                pass_token=args.pass_token,
                region=args.region,
                model=args.model
            )
            records = client.fetch_measurements(since_timestamp_ms=args.since)
            print(json.dumps({
                "success": True,
                "records": records,
                "count": len(records)
            }))
        except PermissionError as pe:
            print(json.dumps({
                "success": False,
                "error": "SESSION_EXPIRED",
                "message": str(pe)
            }))
            sys.exit(2)
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": "SYNC_FAILED",
                "message": str(e)
            }))
            sys.exit(1)

    elif args.command == "test_auth":
        try:
            client = XiaomiScaleClient(
                user_id=args.user_id,
                pass_token=args.pass_token
            )
            client.login_with_pass_token()
            print(json.dumps({"success": True, "valid": True}))
        except PermissionError:
            print(json.dumps({"success": False, "valid": False, "error": "SESSION_EXPIRED"}))
            sys.exit(2)
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)


if __name__ == "__main__":
    main()
