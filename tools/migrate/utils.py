import logging
import time
import asyncio
from typing import Optional
from rich.console import Console
from rich.logging import RichHandler

console = Console()

def setup_logging(verbose: bool = False):
    logging.basicConfig(
        level="DEBUG" if verbose else "INFO",
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True)]
    )

logger = logging.getLogger("migrate")

class RateLimiter:
    def __init__(self, rate: float):
        self.rate = rate
        self.tokens = rate
        self.last_check = time.monotonic()
        self.lock = asyncio.Lock()

    async def wait(self):
        if self.rate <= 0:
            return
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_check
            self.last_check = now
            self.tokens = min(self.rate, self.tokens + elapsed * self.rate)
            
            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1

def format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"
