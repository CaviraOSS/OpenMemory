#!/usr/bin/env node
import { run_migrations } from './core/migrate'

console.log('OpenMemory Database Migration Tool\n')

run_migrations()
    .then(() => {
        console.log('\n[SUCCESS] Migration completed')
        process.exit(0)
    })
    .catch((err) => {
        console.error('\n[FATAL] Migration failed:', err)
        process.exit(1)
    })
