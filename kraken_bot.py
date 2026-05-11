#!/usr/bin/env python3
"""
Kraken Day Trading Bot
Strategy: EMA9/EMA21 crossover on 15-minute candles
Pairs: BTC/USD, ETH/USD, SOL/USD
Capital: $25.00 max | Max position: $10.00 | Stop: $15.00 floor
"""

import os
import sys
import time
import hmac
import hashlib
import base64
import urllib.parse
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_KEY = os.environ.get("KRAKEN_API_KEY", "")
API_SECRET = os.environ.get("KRAKEN_API_SECRET", "")
BASE_URL = "https://api.kraken.com"

WATCHLIST = ["XBTUSD", "ETHUSD", "SOLUSD"]   # Kraken pair names
DISPLAY_NAMES = {"XBTUSD": "BTC/USD", "ETHUSD": "ETH/USD", "SOLUSD": "SOL/USD"}

MAX_POSITION_USD = 10.00
STOP_FLOOR_USD   = 15.00
TAKE_PROFIT_PCT  = 0.03   # 3 %
STOP_LOSS_PCT    = 0.02   # 2 %
EMA_FAST         = 9
EMA_SLOW         = 21
INTERVAL_MIN     = 15     # candle interval in minutes
LOOP_SECONDS     = 15 * 60

COOLDOWN_SECONDS = 30 * 60  # 30 min after a stop-loss hit

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("kraken_bot.log"),
    ],
)
log = logging.getLogger("kraken_bot")

# ---------------------------------------------------------------------------
# Kraken REST helpers
# ---------------------------------------------------------------------------

def _nonce() -> str:
    return str(int(time.time() * 1000))


def _sign(path: str, data: dict, secret: str) -> str:
    nonce = data["nonce"]
    post_data = urllib.parse.urlencode(data)
    encoded = (nonce + post_data).encode()
    message = path.encode() + hashlib.sha256(encoded).digest()
    mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    return base64.b64encode(mac.digest()).decode()


def public_get(endpoint: str, params: dict = None) -> dict:
    url = BASE_URL + endpoint
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"Kraken public API error: {data['error']}")
    return data["result"]


def private_post(endpoint: str, payload: dict = None) -> dict:
    if not API_KEY or not API_SECRET:
        raise RuntimeError(
            "KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables are not set."
        )
    payload = payload or {}
    payload["nonce"] = _nonce()
    path = endpoint
    sig = _sign(path, payload, API_SECRET)
    headers = {"API-Key": API_KEY, "API-Sign": sig}
    url = BASE_URL + endpoint
    resp = requests.post(url, data=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"Kraken private API error: {data['error']}")
    return data["result"]

# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------

def get_ohlcv(pair: str, interval: int = INTERVAL_MIN) -> list[dict]:
    """Return list of candles [{time, open, high, low, close, volume}, ...]."""
    result = public_get("/0/public/OHLC", {"pair": pair, "interval": interval})
    raw = next(v for k, v in result.items() if k != "last")
    candles = []
    for c in raw:
        candles.append({
            "time":   int(c[0]),
            "open":   float(c[1]),
            "high":   float(c[2]),
            "low":    float(c[3]),
            "close":  float(c[4]),
            "volume": float(c[6]),
        })
    return candles


def get_ticker_price(pair: str) -> float:
    result = public_get("/0/public/Ticker", {"pair": pair})
    info = next(iter(result.values()))
    return float(info["c"][0])   # last trade price

# ---------------------------------------------------------------------------
# Technical indicators
# ---------------------------------------------------------------------------

def ema(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    k = 2.0 / (period + 1)
    result = [sum(values[:period]) / period]
    for v in values[period:]:
        result.append(v * k + result[-1] * (1 - k))
    return result


def compute_emas(candles: list[dict]) -> tuple[float, float, float, float]:
    """Return (ema_fast_prev, ema_fast_cur, ema_slow_prev, ema_slow_cur)."""
    closes = [c["close"] for c in candles]
    fast = ema(closes, EMA_FAST)
    slow = ema(closes, EMA_SLOW)
    if len(fast) < 2 or len(slow) < 2:
        raise ValueError("Not enough candles to compute EMAs")
    return fast[-2], fast[-1], slow[-2], slow[-1]

# ---------------------------------------------------------------------------
# Account
# ---------------------------------------------------------------------------

def get_usd_balance() -> float:
    result = private_post("/0/private/Balance")
    zusd = float(result.get("ZUSD", result.get("USD", 0)))
    return zusd


def get_open_orders() -> dict:
    return private_post("/0/private/OpenOrders")


def get_trade_balance() -> dict:
    return private_post("/0/private/TradeBalance")

# ---------------------------------------------------------------------------
# Order placement
# ---------------------------------------------------------------------------

def place_market_order(pair: str, side: str, volume: float) -> dict:
    """Place a market buy or sell order. side: 'buy' | 'sell'."""
    payload = {
        "pair":      pair,
        "type":      side,
        "ordertype": "market",
        "volume":    f"{volume:.8f}",
    }
    result = private_post("/0/private/AddOrder", payload)
    log.info("Order placed: %s %s %s — txids: %s", side.upper(), volume, pair, result.get("txid"))
    return result


def place_limit_order(pair: str, side: str, volume: float, price: float) -> dict:
    payload = {
        "pair":      pair,
        "type":      side,
        "ordertype": "limit",
        "price":     f"{price:.5f}",
        "volume":    f"{volume:.8f}",
    }
    result = private_post("/0/private/AddOrder", payload)
    log.info("Limit order placed: %s %s %s @ %.5f — txids: %s",
             side.upper(), volume, pair, price, result.get("txid"))
    return result


def cancel_order(txid: str) -> None:
    private_post("/0/private/CancelOrder", {"txid": txid})
    log.info("Cancelled order %s", txid)

# ---------------------------------------------------------------------------
# Position state  (in-memory; single position at a time)
# ---------------------------------------------------------------------------

class Position:
    def __init__(self, pair: str, entry_price: float, volume: float, cost_usd: float):
        self.pair        = pair
        self.entry_price = entry_price
        self.volume      = volume
        self.cost_usd    = cost_usd
        self.tp_price    = entry_price * (1 + TAKE_PROFIT_PCT)
        self.sl_price    = entry_price * (1 - STOP_LOSS_PCT)
        self.opened_at   = datetime.now(timezone.utc)

    def __repr__(self):
        return (f"Position({DISPLAY_NAMES.get(self.pair, self.pair)} "
                f"entry={self.entry_price:.4f} vol={self.volume:.6f} "
                f"TP={self.tp_price:.4f} SL={self.sl_price:.4f})")


# ---------------------------------------------------------------------------
# Bot logic
# ---------------------------------------------------------------------------

class KrakenBot:
    def __init__(self):
        self.position: Optional[Position] = None
        self.last_sl_time: Optional[float] = None   # epoch seconds of last stop-loss
        self.confirmed_first_trade = False

    # ------------------------------------------------------------------
    # Startup checks
    # ------------------------------------------------------------------

    def check_credentials(self):
        if not API_KEY or not API_SECRET:
            log.error("KRAKEN_API_KEY and/or KRAKEN_API_SECRET are not set in the environment.")
            log.error("Export them before running:  export KRAKEN_API_KEY=...  export KRAKEN_API_SECRET=...")
            sys.exit(1)

    def verify_balance(self) -> float:
        bal = get_usd_balance()
        log.info("Current USD balance: $%.2f", bal)
        if abs(bal - 25.00) > 0.01:
            log.warning("Balance ($%.2f) differs from expected $25.00. Awaiting user confirmation.", bal)
            ans = input(f"\nBalance is ${bal:.2f}, not $25.00. Continue anyway? [y/N]: ").strip().lower()
            if ans != "y":
                log.info("Aborted by user.")
                sys.exit(0)
        return bal

    # ------------------------------------------------------------------
    # Signal detection
    # ------------------------------------------------------------------

    def detect_signal(self, pair: str) -> Optional[str]:
        """Return 'buy', 'sell', or None."""
        candles = get_ohlcv(pair)
        fp, fc, sp, sc = compute_emas(candles)
        bullish_cross = fp < sp and fc > sc
        bearish_cross = fp > sp and fc < sc
        if bullish_cross:
            return "buy"
        if bearish_cross:
            return "sell"
        return None

    # ------------------------------------------------------------------
    # Position management
    # ------------------------------------------------------------------

    def open_position(self, pair: str, price: float, balance: float):
        if not self.confirmed_first_trade:
            print(f"\n{'='*60}")
            print(f"  FIRST LIVE TRADE REQUEST")
            print(f"  Pair:        {DISPLAY_NAMES.get(pair, pair)}")
            print(f"  Direction:   LONG (buy)")
            print(f"  Entry price: ${price:,.4f}")
            size_usd = min(MAX_POSITION_USD, balance * 0.9)
            volume   = size_usd / price
            print(f"  Size:        ${size_usd:.2f}  ({volume:.6f} units)")
            print(f"  Take-profit: ${price * (1 + TAKE_PROFIT_PCT):,.4f}  (+{TAKE_PROFIT_PCT*100:.0f}%)")
            print(f"  Stop-loss:   ${price * (1 - STOP_LOSS_PCT):,.4f}  (-{STOP_LOSS_PCT*100:.0f}%)")
            print(f"{'='*60}")
            ans = input("  Confirm first live trade? [y/N]: ").strip().lower()
            if ans != "y":
                log.info("First trade declined by user.")
                return
            self.confirmed_first_trade = True

        size_usd = min(MAX_POSITION_USD, balance * 0.9)
        volume   = size_usd / price
        result   = place_market_order(pair, "buy", volume)
        self.position = Position(pair, price, volume, size_usd)
        log.info("[OPEN] %s | entry=$%.4f | vol=%.6f | cost=$%.2f | TP=$%.4f | SL=$%.4f",
                 DISPLAY_NAMES.get(pair, pair), price, volume, size_usd,
                 self.position.tp_price, self.position.sl_price)
        self._print_trade_summary("OPEN", price, None, 0.0, 0.0, None)

    def close_position(self, reason: str, current_price: float):
        pos = self.position
        if pos is None:
            return
        place_market_order(pos.pair, "sell", pos.volume)
        pnl_usd = (current_price - pos.entry_price) * pos.volume
        pnl_pct = (current_price - pos.entry_price) / pos.entry_price * 100
        duration = datetime.now(timezone.utc) - pos.opened_at
        log.info("[CLOSE] %s | reason=%s | entry=$%.4f | exit=$%.4f | P&L=$%.4f (%.2f%%) | held=%s",
                 DISPLAY_NAMES.get(pos.pair, pos.pair), reason,
                 pos.entry_price, current_price, pnl_usd, pnl_pct, duration)
        if reason == "STOP_LOSS":
            self.last_sl_time = time.time()
        new_bal = get_usd_balance()
        self._print_trade_summary("CLOSE", pos.entry_price, current_price, pnl_usd, pnl_pct, new_bal)
        self.position = None
        if new_bal <= STOP_FLOOR_USD:
            log.critical("Balance $%.2f has hit the $%.2f floor — STOPPING ALL TRADING.", new_bal, STOP_FLOOR_USD)
            sys.exit(1)

    def _print_trade_summary(self, action, entry, exit_price, pnl_usd, pnl_pct, balance):
        print(f"\n{'─'*55}")
        print(f"  TRADE SUMMARY [{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}]")
        print(f"  Action:      {action}")
        if self.position:
            print(f"  Pair:        {DISPLAY_NAMES.get(self.position.pair, self.position.pair)}")
            print(f"  Direction:   LONG")
        print(f"  Entry:       ${entry:,.4f}")
        if exit_price is not None:
            print(f"  Exit:        ${exit_price:,.4f}")
            arrow = "+" if pnl_usd >= 0 else ""
            print(f"  P&L:         {arrow}${pnl_usd:.4f}  ({arrow}{pnl_pct:.2f}%)")
        if balance is not None:
            print(f"  Balance:     ${balance:.2f}")
        print(f"{'─'*55}\n")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def in_cooldown(self) -> bool:
        if self.last_sl_time is None:
            return False
        elapsed = time.time() - self.last_sl_time
        if elapsed < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - elapsed)
            log.info("In cooldown after stop-loss. %d min %d sec remaining.",
                     remaining // 60, remaining % 60)
            return True
        return False

    def run_once(self):
        """Execute one iteration of the trading loop."""
        log.info("── Tick ──────────────────────────────────────────────")
        balance = get_usd_balance()
        log.info("USD balance: $%.2f", balance)

        # Check floor
        if balance <= STOP_FLOOR_USD:
            log.critical("Balance $%.2f ≤ floor $%.2f — STOPPING.", balance, STOP_FLOOR_USD)
            sys.exit(1)

        # --- Manage existing position ---
        if self.position is not None:
            pos = self.position
            price = get_ticker_price(pos.pair)
            log.info("Position: %s | current=$%.4f | TP=$%.4f | SL=$%.4f",
                     DISPLAY_NAMES.get(pos.pair, pos.pair), price,
                     pos.tp_price, pos.sl_price)
            if price >= pos.tp_price:
                log.info("Take-profit triggered at $%.4f", price)
                self.close_position("TAKE_PROFIT", price)
            elif price <= pos.sl_price:
                log.warning("Stop-loss triggered at $%.4f", price)
                self.close_position("STOP_LOSS", price)
            else:
                # Check EMA exit signal
                signal = self.detect_signal(pos.pair)
                if signal == "sell":
                    log.info("EMA bearish crossover — exiting position.")
                    self.close_position("EMA_EXIT", price)
            return   # only one position at a time

        # --- Look for new entry ---
        if self.in_cooldown():
            return

        for pair in WATCHLIST:
            try:
                signal = self.detect_signal(pair)
                price  = get_ticker_price(pair)
                log.info("%s price=$%.4f | signal=%s",
                         DISPLAY_NAMES.get(pair, pair), price, signal or "none")
                if signal == "buy":
                    log.info("EMA bullish crossover detected on %s — opening position.",
                             DISPLAY_NAMES.get(pair, pair))
                    self.open_position(pair, price, balance)
                    break   # only one position at a time
            except Exception as exc:
                log.error("Error scanning %s: %s", pair, exc)

    def run(self):
        self.check_credentials()
        log.info("Kraken Trading Bot starting up…")
        log.info("Watchlist: %s", ", ".join(DISPLAY_NAMES[p] for p in WATCHLIST))
        log.info("Max position: $%.2f | TP: %.0f%% | SL: %.0f%% | Candles: %d-min",
                 MAX_POSITION_USD, TAKE_PROFIT_PCT * 100, STOP_LOSS_PCT * 100, INTERVAL_MIN)

        self.verify_balance()

        while True:
            try:
                self.run_once()
            except KeyboardInterrupt:
                log.info("Interrupted by user — shutting down.")
                sys.exit(0)
            except Exception as exc:
                log.error("Unexpected error in main loop: %s", exc, exc_info=True)
            log.info("Sleeping %d minutes until next tick…", INTERVAL_MIN)
            time.sleep(LOOP_SECONDS)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    KrakenBot().run()
