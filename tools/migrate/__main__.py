import asyncio
import argparse
import os
import sys
from .schemas import MigrationConfig, ProviderType
from .providers.zep import ZepProvider
from .providers.mem0 import Mem0Provider
from .providers.supermemory import SupermemoryProvider
from .importer import Importer
from .verifier import Verifier
from .utils import setup_logging, logger, format_duration

PROVIDERS = {
    ProviderType.ZEP: ZepProvider,
    ProviderType.MEM0: Mem0Provider,
    ProviderType.SUPERMEMORY: SupermemoryProvider
}

async def main():
    parser = argparse.ArgumentParser(description="OpenMemory Migration Tool")
    parser.add_argument("--from", dest="provider", required=True, choices=["zep", "mem0", "supermemory"], help="Source provider")
    parser.add_argument("--api-key", required=True, help="Source API Key")
    parser.add_argument("--url", help="Source API URL (optional)")
    parser.add_argument("--output", default="./exports", help="Export directory")
    parser.add_argument("--openmemory-url", default=os.getenv("OPENMEMORY_URL", "http://localhost:8080"), help="Target OpenMemory URL")
    parser.add_argument("--openmemory-key", default=os.getenv("OPENMEMORY_API_KEY", ""), help="Target OpenMemory Key")
    parser.add_argument("--verbose", action="store_true", help="Debug logging")
    parser.add_argument("--verify", action="store_true", help="Run verification")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--rate-limit", type=float, default=0.0) # 0 = Provider default

    args = parser.parse_args()
    setup_logging(args.verbose)

    # Defaults for rate limit if not set
    rl = args.rate_limit
    if rl <= 0:
        if args.provider == "zep": rl = 1.0
        elif args.provider == "mem0": rl = 20.0
        elif args.provider == "supermemory": rl = 5.0

    config = MigrationConfig(
        provider=ProviderType(args.provider),
        api_key=args.api_key,
        source_url=args.url,
        output_dir=args.output,
        batch_size=args.batch_size,
        rate_limit=rl,
        openmemory_url=args.openmemory_url,
        openmemory_key=args.openmemory_key,
        verify=args.verify
    )

    logger.info("=== OpenMemory Migration Tool ===")
    logger.info(f"Source: {config.provider.value}")
    logger.info(f"Target: {config.openmemory_url}")

    os.makedirs(config.output_dir, exist_ok=True)
    
    provider_cls = PROVIDERS[config.provider]
    provider = provider_cls(config)

    try:
        # 1. Connect
        logger.info("\n[PHASE 1] Connecting...")
        conn_stats = await provider.connect()
        logger.info(f"Connected: {conn_stats}")

        # 2. Export
        logger.info("\n[PHASE 2] Exporting...")
        export_file = os.path.join(config.output_dir, f"{config.provider.value}_export.jsonl")
        
        # Check if we should resume? (Not implemented in args, skipping for now)
        # Assuming fresh export
        with open(export_file, "w", encoding="utf-8") as f:
            count = 0
            async for record in provider.export():
                import dataclasses, json
                f.write(json.dumps(dataclasses.asdict(record)) + "\n")
                count += 1
        logger.info(f"Exported {count} records to {export_file}")

        # 3. Import
        logger.info("\n[PHASE 3] Importing...")
        importer = Importer(config)
        try:
            stats = await importer.run(export_file)
            logger.info(f"Import Finished: {stats.imported} imported, {stats.failed} failed in {format_duration(stats.duration)}")
            
            # 4. Verify
            if config.verify:
                logger.info("\n[PHASE 4] Verifying...")
                verifier = Verifier(config)
                await verifier.verify(stats)

        finally:
            await importer.close()

    except Exception as e:
        logger.error(f"[FATAL] {e}")
        sys.exit(1)
    finally:
        await provider.close()
        logger.info("\nDone.")

if __name__ == "__main__":
    asyncio.run(main())
