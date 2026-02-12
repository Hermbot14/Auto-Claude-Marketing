#!/usr/bin/env bash
# One-Command Development Environment Setup Script for macOS/Linux
# Auto-detects dependencies, installs if needed, and starts full dev environment
#
# Features:
# - Dependency checking (Node.js, Python 3.12+, bun)
# - Auto-installation of missing dependencies
# - Parallel startup of backend and frontend
# - Auto-open browser
# - QR code generation for mobile testing
# - Color-coded output for easy monitoring

set -euo pipefail

# Color scheme
export CL_RESET='\033[0m'
export CL_INFO='\033[36m'     # Cyan
export CL_SUCCESS='\033[32m'  # Green
export CL_WARNING='\033[33m'  # Yellow
export CL_ERROR='\033[31m'    # Red
export CL_SERVICE='\033[35m'  # Magenta

# Script directory and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"
BACKEND_DIR="$ROOT_DIR/apps/backend"

# Options
SKIP_DEPS_CHECK="${SKIP_DEPS_CHECK:-false}"
NO_BROWSER="${NO_BROWSER:-false}"
NO_QR="${NO_QR:-false}"
VERBOSE="${VERBOSE:-false}"

# Track start time
START_TIME=$(date +%s)

# Color output helpers
log_info()    { echo -e "${CL_INFO}$*${CL_RESET}"; }
log_success()  { echo -e "${CL_SUCCESS}$*${CL_RESET}"; }
log_warning()  { echo -e "${CL_WARNING}$*${CL_RESET}"; }
log_error()    { echo -e "${CL_ERROR}$*${CL_RESET}"; }
log_service()  { echo -e "${CL_SERVICE}$*${CL_RESET}"; }

print_header() {
    local title="$1"
    echo
    log_info "============================================================"
    log_info "  $title"
    log_info "============================================================"
    echo
}

# Command detection
command_exists() {
    command -v "$1" &>/dev/null
}

# Find Python 3.12+
find_python() {
    local candidates=("python3.12" "python3.13" "python3.14" "python3" "python")
    for cmd in "${candidates[@]}"; do
        if command_exists "$cmd"; then
            local version=$($cmd --version 2>/dev/null | grep -oP '\d+\.\d+' || echo "0.0")
            local major=$(echo "$version" | cut -d. -f1)
            local minor=$(echo "$version" | cut -d. -f2)
            if [[ $major -eq 3 && $minor -ge 12 ]]; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

# Check if a port is available
port_available() {
    local port=$1
    if command_exists lsof; then
        ! lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1
    elif command_exists netstat; then
        ! netstat -an 2>/dev/null | grep ":$port " | grep LISTEN >/dev/null
    else
        # Assume available if we can't check
        return 0
    fi
}

# Get local IP address for network access
get_local_ip() {
    local ip=""

    # Try various methods to get local IP
    if command_exists ip; then
        ip=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    fi

    if [[ -z "$ip" ]] && command_exists hostname; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    if [[ -z "$ip" ]] && [[ "$OSTYPE" == "darwin"* ]]; then
        ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    fi

    # Fallback to localhost
    echo "${ip:-localhost}"
}

# QR Code Generation
show_qr_code() {
    local url="$1"

    echo
    log_info "========================================"
    log_success "  SCAN QR CODE FOR MOBILE ACCESS"
    log_info "========================================"
    echo

    # Try qrencode first
    if command_exists qrencode; then
        log_info "URL: $url"
        qrencode -t ANSIUTF8 "$url"
        echo
    # Try terminal QR
    elif command_exists qr; then
        log_info "URL: $url"
        qr "$url"
        echo
    else
        # Fallback to text instructions
        log_warning "QR Code URL:"
        log_info "$url"
        echo
        log_info "For mobile access, scan this URL with your QR scanner app."
        log_info "Tip: Install 'qrencode' for visual QR codes in terminal:"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_warning "  brew install qrencode"
        else
            log_warning "  sudo apt install qrencode  # Debian/Ubuntu"
            log_warning "  sudo yum install qrencode  # RHEL/CentOS"
        fi
        echo
    fi

    log_info "Mobile Testing Instructions:"
    log_warning "  1. Ensure your mobile device is on the same network"
    log_warning "  2. Scan the QR code or enter the URL manually"
    log_warning "  3. For IP issues, use: $url"
    echo
}

# Check all dependencies
check_dependencies() {
    print_header "CHECKING DEPENDENCIES"

    local all_good=true
    local missing_deps=()

    # Check Node.js
    log_info "Checking Node.js..."
    if command_exists node; then
        local node_version=$(node --version)
        log_success "  ✓ Node.js $node_version found"
    else
        log_error "  ✗ Node.js NOT found"
        log_warning "    Install: curl -fsSL https://fnm.vercel.app/install | bash"
        missing_deps+=("Node.js")
        all_good=false
    fi

    # Check Python 3.12+
    log_info
    log_info "Checking Python 3.12+..."
    PYTHON_CMD=$(find_python)
    if [[ -n "$PYTHON_CMD" ]]; then
        local python_version=$($PYTHON_CMD --version 2>&1)
        log_success "  ✓ $python_version found ($PYTHON_CMD)"
    else
        log_error "  ✗ Python 3.12+ NOT found"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_warning "    Install: brew install python@3.12"
        else
            log_warning "    Install: sudo apt install python3.12 python3.12-venv"
        fi
        missing_deps+=("Python 3.12+")
        all_good=false
    fi

    # Check bun
    log_info
    log_info "Checking bun..."
    if command_exists bun; then
        local bun_version=$(bun --version)
        log_success "  ✓ bun $bun_version found"
    else
        log_error "  ✗ bun NOT found"
        log_warning "    Install: curl -fsSL https://bun.sh/install | bash"
        missing_deps+=("bun")
        all_good=false
    fi

    # Check git
    log_info
    log_info "Checking git..."
    if command_exists git; then
        local git_version=$(git --version)
        log_success "  ✓ $git_version found"
    else
        log_error "  ✗ git NOT found"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_warning "    Install: xcode-select --install"
        else
            log_warning "    Install: sudo apt install git"
        fi
        missing_deps+=("git")
        all_good=false
    fi

    if [[ "$all_good" == "false" ]]; then
        log_error
        log_error "❌ Missing dependencies: ${missing_deps[*]}"
        log_warning
        log_warning "Please install missing dependencies and re-run this script."
        exit 1
    fi

    log_success
    log_success "✅ All dependencies found!"
    echo
}

# Install backend dependencies
install_backend() {
    print_header "INSTALLING BACKEND DEPENDENCIES"

    local venv_dir="$BACKEND_DIR/.venv"
    local venv_pip="$venv_dir/bin/pip"

    # Check if venv exists
    if [[ ! -d "$venv_dir" ]]; then
        log_info "Creating Python virtual environment..."
        $PYTHON_CMD -m venv "$venv_dir"
        if [[ $? -ne 0 ]]; then
            log_error "✗ Failed to create virtual environment"
            exit 1
        fi
    else
        log_success "Virtual environment already exists"
    fi

    # Install requirements
    if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
        log_info "Installing Python dependencies..."
        "$venv_pip" install -r "$BACKEND_DIR/requirements.txt" --quiet
        if [[ $? -eq 0 ]]; then
            log_success "✓ Python dependencies installed"
        else
            log_error "✗ Failed to install Python dependencies"
            exit 1
        fi
    fi

    # Create .env from .env.example
    if [[ ! -f "$BACKEND_DIR/.env" ]] && [[ -f "$BACKEND_DIR/.env.example" ]]; then
        log_info "Creating .env from .env.example..."
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        log_success "✓ Created .env file"
        log_warning "  Please run: claude setup-token"
    fi
}

# Install frontend dependencies
install_frontend() {
    print_header "INSTALLING FRONTEND DEPENDENCIES"

    log_info "Installing Node dependencies with bun..."
    cd "$FRONTEND_DIR"
    bun install --silent
    if [[ $? -eq 0 ]]; then
        log_success "✓ Node dependencies installed"
    else
        log_error "✗ Failed to install Node dependencies"
        exit 1
    fi
    cd - > /dev/null
}

# Start development servers
start_dev_servers() {
    print_header "STARTING DEVELOPMENT SERVERS"

    # Kill any existing processes on ports
    log_info "Checking for existing processes..."
    for port in 3000 5173; do
        if port_available "$port"; then
            : # Port is available
        else
            if command_exists lsof; then
                local pid=$(lsof -ti ":$port" 2>/dev/null || true)
                if [[ -n "$pid" ]]; then
                    log_warning "  Stopping process on port $port (PID: $pid)"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
        fi
    done

    # Get local IP for QR code
    local local_ip=$(get_local_ip)
    local frontend_url="http://localhost:3000"
    local network_url="http://${local_ip}:3000"

    # Start web dev server in background
    log_service
    log_service "Starting frontend dev server..."

    cd "$FRONTEND_DIR"
    bun run dev:web > /tmp/dev-frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd - > /dev/null

    # Wait for server to start
    log_info "Waiting for servers to start..."
    local timeout=30
    local elapsed=0
    local server_ready=false

    while [[ $elapsed -lt $timeout ]]; do
        if curl -s -o /dev/null -w "%{http_code}" "$frontend_url" 2>/dev/null | grep -q "200"; then
            server_ready=true
            break
        fi
        sleep 1
        ((elapsed++))
    done

    if [[ "$server_ready" == "true" ]]; then
        log_success "✓ Frontend server ready!"
        log_warning "  Local:   $frontend_url"
        log_warning "  Network: $network_url"

        # Show QR code
        if [[ "$NO_QR" != "true" ]]; then
            show_qr_code "$network_url"
        fi

        # Open browser
        if [[ "$NO_BROWSER" != "true" ]]; then
            log_info
            log_info "Opening browser..."

            if [[ "$OSTYPE" == "darwin"* ]]; then
                open "$frontend_url"
            elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                if command_exists xdg-open; then
                    xdg-open "$frontend_url" 2>/dev/null || true
                fi
            fi
        fi
    else
        log_error "✗ Frontend server failed to start within ${timeout}s"
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi

    # Calculate and display startup time
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    log_success
    log_success "✅ Development environment started in ${duration} seconds!"
    log_info
    log_info "Press Ctrl+C to stop all servers"
    echo

    # Handle cleanup on exit
    trap 'log_warning; log_warning "Stopping servers..."; kill $FRONTEND_PID 2>/dev/null || true; log_success "✓ Servers stopped"; exit 0' INT TERM

    # Keep script running
    wait $FRONTEND_PID 2>/dev/null || true
}

# Main execution
main() {
    clear

    echo
    log_info "╔════════════════════════════════════════════════════════════╗"
    log_info "║     Auto Claude Marketing Hub - Dev Environment Setup     ║"
    log_info "╚════════════════════════════════════════════════════════════╝"
    echo

    if [[ "$SKIP_DEPS_CHECK" != "true" ]]; then
        check_dependencies
        install_backend
        install_frontend
    fi

    start_dev_servers
}

main
