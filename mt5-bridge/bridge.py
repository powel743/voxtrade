"""
VoxTrade — MT5 Bridge
=====================

A small Flask server that runs locally on the user's Windows PC. It exposes the
MetaTrader 5 terminal (connected to an Exness account) over HTTP so the hosted
Render backend can fetch candles and place trades through an ngrok / Cloudflare
tunnel.

Endpoints:
    GET  /status            -> account / connection snapshot (ALWAYS 200)
    GET  /candles           -> OHLCV candles for a symbol / timeframe
    POST /trade             -> place a market order with SL / TP in pips
    GET  /open-positions    -> all open positions for a symbol
    POST /close-position    -> close a position by ticket

Run:
    python bridge.py
    # or, for production:
    waitress-serve --port=5001 bridge:app
"""

import os
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

import MetaTrader5 as mt5

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("voxtrade-bridge")

MT5_LOGIN = os.getenv("MT5_LOGIN", "").strip()
MT5_PASSWORD = os.getenv("MT5_PASSWORD", "").strip()
MT5_SERVER = os.getenv("MT5_SERVER", "Exness-MT5Real").strip()
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "5001"))

# For XAUUSD: 1 pip = 0.10 (point * 10). Used for all SL/TP offset math.
PIP_SIZE = 0.10

TIMEFRAME_MAP = {
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
    "M15": mt5.TIMEFRAME_M15,
    "M5": mt5.TIMEFRAME_M5,
}

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


# ─────────────────────────────────────────────────────────────────────────────
# MT5 initialization / login
# ─────────────────────────────────────────────────────────────────────────────

def init_mt5() -> bool:
    """Initialize MT5 and attempt login. Never raises — logs and returns bool."""
    try:
        if not mt5.initialize():
            log.error("mt5.initialize() failed: %s", mt5.last_error())
            return False

        if not MT5_LOGIN:
            log.warning(
                "MT5_LOGIN is empty. The terminal must already be logged in "
                "manually, or fill credentials in .env."
            )
            return mt5.account_info() is not None

        try:
            login_id = int(MT5_LOGIN)
        except ValueError:
            log.error("MT5_LOGIN must be a number, got: %r", MT5_LOGIN)
            return False

        authorized = mt5.login(
            login=login_id,
            password=MT5_PASSWORD,
            server=MT5_SERVER,
        )
        if not authorized:
            log.error(
                "MT5 login failed for account %s on %s: %s",
                login_id, MT5_SERVER, mt5.last_error(),
            )
            return False

        info = mt5.account_info()
        if info is None:
            log.error("Logged in but account_info() returned None: %s", mt5.last_error())
            return False

        log.info("MT5 login OK — account %s on %s", info.login, info.server)
        return True
    except Exception as exc:  # noqa: BLE001 — keep the server alive no matter what
        log.exception("Unexpected error during MT5 init: %s", exc)
        return False


def is_connected() -> bool:
    """True if MT5 currently has a live account session."""
    try:
        return mt5.account_info() is not None
    except Exception:  # noqa: BLE001
        return False


def ensure_connected() -> bool:
    """Best-effort reconnect if the session dropped."""
    if is_connected():
        return True
    log.warning("MT5 session lost — attempting to reconnect...")
    return init_mt5()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def ensure_symbol(symbol: str) -> bool:
    """Make sure the symbol is visible in Market Watch."""
    info = mt5.symbol_info(symbol)
    if info is None:
        log.error("symbol_info(%s) returned None: %s", symbol, mt5.last_error())
        return False
    if not info.visible:
        if not mt5.symbol_select(symbol, True):
            log.error("symbol_select(%s) failed: %s", symbol, mt5.last_error())
            return False
    return True


def position_type_name(pos_type: int) -> str:
    return "BUY" if pos_type == mt5.POSITION_TYPE_BUY else "SELL"


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/status", methods=["GET"])
def status():
    """
    Connection + account snapshot.

    MUST always return HTTP 200 — this endpoint is pinged every 10 minutes by
    cron-job.org to keep the Render backend warm. Never return 500 here.
    """
    try:
        if not ensure_connected():
            return jsonify({
                "connected": False,
                "account": "",
                "balance": 0.0,
                "equity": 0.0,
                "margin_free": 0.0,
                "server": MT5_SERVER,
                "ping": "pong",
            }), 200

        info = mt5.account_info()
        if info is None:
            return jsonify({
                "connected": False,
                "account": "",
                "balance": 0.0,
                "equity": 0.0,
                "margin_free": 0.0,
                "server": MT5_SERVER,
                "ping": "pong",
            }), 200

        return jsonify({
            "connected": True,
            "account": str(info.login),
            "balance": float(info.balance),
            "equity": float(info.equity),
            "margin_free": float(info.margin_free),
            "server": str(info.server),
            "ping": "pong",
        }), 200
    except Exception as exc:  # noqa: BLE001 — never 500 on /status
        log.exception("Error in /status: %s", exc)
        return jsonify({
            "connected": False,
            "account": "",
            "balance": 0.0,
            "equity": 0.0,
            "margin_free": 0.0,
            "server": MT5_SERVER,
            "ping": "pong",
        }), 200


@app.route("/candles", methods=["GET"])
def candles():
    """Fetch OHLCV candles. /candles?symbol=XAUUSD&tf=H1&count=100"""
    symbol = request.args.get("symbol", "XAUUSD").strip()
    tf = request.args.get("tf", "H1").strip().upper()
    try:
        count = int(request.args.get("count", "100"))
    except ValueError:
        return jsonify({"error": "count must be an integer"}), 400

    count = max(1, min(count, 1000))

    if tf not in TIMEFRAME_MAP:
        return jsonify({
            "error": f"Invalid timeframe '{tf}'. Use one of: {', '.join(TIMEFRAME_MAP)}"
        }), 400

    if not ensure_connected():
        return jsonify({"error": "MT5 not connected"}), 503

    if not ensure_symbol(symbol):
        return jsonify({"error": f"Symbol '{symbol}' not available"}), 400

    rates = mt5.copy_rates_from_pos(symbol, TIMEFRAME_MAP[tf], 0, count)
    if rates is None or len(rates) == 0:
        return jsonify({
            "error": f"No candle data for {symbol} {tf}: {mt5.last_error()}"
        }), 502

    out = []
    for r in rates:
        out.append({
            "time": datetime.fromtimestamp(int(r["time"]), tz=timezone.utc).isoformat(),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": int(r["tick_volume"]),
        })

    # copy_rates_from_pos already returns ascending by time; sort to be safe.
    out.sort(key=lambda c: c["time"])
    return jsonify(out), 200


@app.route("/trade", methods=["POST"])
def trade():
    """
    Place a market order.

    Body: { symbol, action, lot, sl_pips, tp_pips }
      action  : "BUY" | "SELL"
      For XAUUSD 1 pip = 0.10:
        BUY  -> sl = price - sl_pips*0.10 ; tp = price + tp_pips*0.10
        SELL -> sl = price + sl_pips*0.10 ; tp = price - tp_pips*0.10
    """
    body = request.get_json(silent=True) or {}
    symbol = str(body.get("symbol", "XAUUSD")).strip()
    action = str(body.get("action", "")).strip().upper()

    try:
        lot = float(body.get("lot", 0.01))
        sl_pips = float(body.get("sl_pips", 0))
        tp_pips = float(body.get("tp_pips", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "comment": "lot/sl_pips/tp_pips must be numbers"}), 400

    if action not in ("BUY", "SELL"):
        return jsonify({"success": False, "comment": "action must be BUY or SELL"}), 400

    if not ensure_connected():
        return jsonify({"success": False, "comment": "MT5 not connected"}), 503

    if not ensure_symbol(symbol):
        return jsonify({"success": False, "comment": f"Symbol '{symbol}' not available"}), 400

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return jsonify({"success": False, "comment": f"No tick for {symbol}: {mt5.last_error()}"}), 502

    sym_info = mt5.symbol_info(symbol)
    digits = sym_info.digits if sym_info is not None else 2

    if action == "BUY":
        order_type = mt5.ORDER_TYPE_BUY
        price = float(tick.ask)
        sl = round(price - sl_pips * PIP_SIZE, digits)
        tp = round(price + tp_pips * PIP_SIZE, digits)
    else:  # SELL
        order_type = mt5.ORDER_TYPE_SELL
        price = float(tick.bid)
        sl = round(price + sl_pips * PIP_SIZE, digits)
        tp = round(price - tp_pips * PIP_SIZE, digits)

    base_request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": 20240601,
        "comment": "VoxTrade",
        "type_time": mt5.ORDER_TIME_GTC,
    }

    # Try IOC first, fall back to FOK.
    result = None
    for filling in (mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK):
        req = dict(base_request)
        req["type_filling"] = filling
        result = mt5.order_send(req)
        if result is None:
            log.error("order_send returned None (filling=%s): %s", filling, mt5.last_error())
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            break
        # If rejected specifically for filling mode, retry with the next mode.
        if result.retcode != mt5.TRADE_RETCODE_INVALID_FILL:
            break

    if result is None:
        return jsonify({
            "success": False,
            "retcode": -1,
            "order": 0,
            "comment": f"order_send failed: {mt5.last_error()}",
            "price": price,
            "sl": sl,
            "tp": tp,
        }), 502

    success = result.retcode == mt5.TRADE_RETCODE_DONE
    return jsonify({
        "success": success,
        "retcode": int(result.retcode),
        "order": int(result.order),
        "comment": str(result.comment),
        "price": float(result.price) if result.price else price,
        "sl": sl,
        "tp": tp,
    }), 200


@app.route("/open-positions", methods=["GET"])
def open_positions():
    """All open positions for a symbol (default XAUUSD)."""
    symbol = request.args.get("symbol", "XAUUSD").strip()

    if not ensure_connected():
        return jsonify({"error": "MT5 not connected"}), 503

    positions = mt5.positions_get(symbol=symbol)
    if positions is None:
        return jsonify([]), 200

    out = []
    for p in positions:
        out.append({
            "ticket": int(p.ticket),
            "type": position_type_name(p.type),
            "volume": float(p.volume),
            "open_price": float(p.price_open),
            "sl": float(p.sl),
            "tp": float(p.tp),
            "profit": float(p.profit),
            "open_time": datetime.fromtimestamp(int(p.time), tz=timezone.utc).isoformat(),
        })
    return jsonify(out), 200


@app.route("/close-position", methods=["POST"])
def close_position():
    """Close a position by ticket. Body: { ticket: int }"""
    body = request.get_json(silent=True) or {}
    try:
        ticket = int(body.get("ticket"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "comment": "ticket must be an integer"}), 400

    if not ensure_connected():
        return jsonify({"success": False, "comment": "MT5 not connected"}), 503

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return jsonify({"success": False, "comment": f"Position {ticket} not found"}), 404

    pos = positions[0]
    symbol = pos.symbol

    if not ensure_symbol(symbol):
        return jsonify({"success": False, "comment": f"Symbol '{symbol}' not available"}), 400

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return jsonify({"success": False, "comment": f"No tick for {symbol}"}), 502

    # Closing a BUY means selling at bid; closing a SELL means buying at ask.
    if pos.type == mt5.POSITION_TYPE_BUY:
        close_type = mt5.ORDER_TYPE_SELL
        price = float(tick.bid)
    else:
        close_type = mt5.ORDER_TYPE_BUY
        price = float(tick.ask)

    base_request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(pos.volume),
        "type": close_type,
        "position": int(ticket),
        "price": price,
        "deviation": 20,
        "magic": 20240601,
        "comment": "VoxTrade close",
        "type_time": mt5.ORDER_TIME_GTC,
    }

    result = None
    for filling in (mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK):
        req = dict(base_request)
        req["type_filling"] = filling
        result = mt5.order_send(req)
        if result is None:
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            break
        if result.retcode != mt5.TRADE_RETCODE_INVALID_FILL:
            break

    if result is None:
        return jsonify({"success": False, "comment": f"order_send failed: {mt5.last_error()}"}), 502

    success = result.retcode == mt5.TRADE_RETCODE_DONE
    return jsonify({"success": success, "comment": str(result.comment)}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

connected_at_boot = init_mt5()
if connected_at_boot:
    log.info("MT5 Bridge running on port %s", BRIDGE_PORT)
else:
    log.warning(
        "Starting Flask server WITHOUT an active MT5 session. "
        "Fix credentials in .env or log in to the MT5 terminal manually; "
        "the bridge will keep retrying on each request."
    )

if __name__ == "__main__":
    # Flask dev server. For production use:
    #   waitress-serve --port=5001 bridge:app
    app.run(host="0.0.0.0", port=BRIDGE_PORT, threaded=True)
