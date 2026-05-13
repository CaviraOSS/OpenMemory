.PHONY: help install dev build start test clean

PKG=packages/openmemory-js

help:
	@echo "OpenMemory JS cleanup commands"
	@echo "  make install  - install JS package dependencies"
	@echo "  make dev      - start JS server in development mode"
	@echo "  make build    - build JS package"
	@echo "  make start    - start built JS server"
	@echo "  make test     - run JS verification test"
	@echo "  make clean    - remove JS build output"

install:
	cd $(PKG) && npm install

dev:
	cd $(PKG) && npm run dev

build:
	cd $(PKG) && npm run build

start:
	cd $(PKG) && npm run start

test:
	cd $(PKG) && npx tsx tests/test_omnibus.ts

clean:
	cd $(PKG) && rm -rf dist

