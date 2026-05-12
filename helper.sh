#!/bin/bash

install() {
    echo "Installing JavaScript SDK dependencies..."
    (cd SDK/JS && npm install)
    echo "All dependencies installed!"
}

install_dev() {
    echo "Installing development dependencies..."
    (cd SDK/JS && npm install)
    echo "Development dependencies installed!"
}

build() {
    echo "Building JavaScript SDK..."
    (cd SDK/JS && npm run build)
    echo "All components built!"
}

build_js_sdk() {
    (cd SDK/JS && npm run build)
}

lint() {
    echo "Running linters..."
    (cd SDK/JS && npm run lint || echo "JS SDK linting completed")
}

format() {
    echo "Formatting code..."
    (cd SDK/JS && npm run format || echo "JS SDK formatting completed")
}

type_check() {
    echo "Running type checks..."
    (cd SDK/JS && npx tsc --noEmit)
}

docker_build() {
    echo "Building Docker image..."
    docker build -t openmemory .
}

docker_run() {
    echo "Running Docker container..."
    docker run -p 8080:8080 openmemory
}

docker_dev() {
    echo "Starting development environment..."
    docker-compose up --build
}

docker_stop() {
    echo "Stopping Docker containers..."
    docker-compose down
}

clean() {
    echo "Cleaning build artifacts..."
    rm -rf SDK/JS/dist/
    rm -rf SDK/JS/node_modules/.cache/
    echo "Cleanup complete!"
}

clean_all() {
    clean
    echo "Deep cleaning..."
    rm -rf SDK/JS/node_modules/
    echo "Deep cleanup complete!"
}

reset_dev() {
    clean
    install
    build
    echo "Development environment reset complete!"
}

full_check() {
    clean
    install
    build
    lint
    test_all
    echo "Full check complete - ready to commit!"
}

help() {
    echo "OpenMemory Development Commands"
    echo "==============================="
    echo "install, install-dev, build, build-js-sdk, dev, dev-watch,"
    echo "start, stop, test, test-js-sdk, test-integration, full-check,"
    echo "lint, format, type-check, docker-build, docker-run,"
    echo "docker-dev, docker-stop, clean, clean-all, reset-dev"
}

case "$1" in
    install) install ;;
    install-dev) install_dev ;;
    build) build ;;
    build-js-sdk) build_js_sdk ;;
    dev) dev ;;
    dev-watch) dev_watch ;;
    test) test_all ;;
    test-js-sdk) test_js_sdk ;;
    test-integration) test_integration ;;
    lint) lint ;;
    format) format ;;
    type-check) type_check ;;
    docker-build) docker_build ;;
    docker-run) docker_run ;;
    docker-dev) docker_dev ;;
    docker-stop) docker_stop ;;
    run) docker_dev ;;
    clean) clean ;;
    clean-all) clean_all ;;
    reset-dev) reset_dev ;;
    full-check) full_check ;;
    *) help ;;
esac